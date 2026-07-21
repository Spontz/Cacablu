/* global process, console, File, atob, window, document, HTMLElement */

import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { Builder, By, Key, Origin, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';

const projectPath = process.env.CACABLU_PROJECT_PATH;
if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a Cacablu SQLite project.');
await access(projectPath);

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://localhost:5173/';
const projectName = projectPath.split(/[\\/]/).at(-1);
const projectBase64 = (await readFile(projectPath)).toString('base64');
const options = new edge.Options().addArguments('--start-maximized');
const driver = await new Builder()
  .forBrowser('MicrosoftEdge')
  .setEdgeOptions(options)
  .build();

function readWindowsClipboardText() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not read the Windows clipboard: ${result.stderr}`);
  return result.stdout;
}

async function installProjectPicker() {
  await driver.executeScript((name, base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const createHandle = () => ({
      kind: 'file',
      name,
      getFile: async () => new File([bytes], name, { type: 'application/x-sqlite3' }),
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
      isSameEntry: async () => false,
    });
    window.showOpenFilePicker = async () => [createHandle()];
    window.showSaveFilePicker = async () => createHandle();
  }, projectName, projectBase64);
}

async function shortcut(key) {
  await driver.actions().keyDown(Key.CONTROL).sendKeys(key).keyUp(Key.CONTROL).perform();
}

async function openProject() {
  await driver.get(baseUrl);
  await installProjectPicker();
  await driver.executeScript(() => {
    window.__seleniumClipboardTrace = [];
    for (const type of ['keydown', 'copy', 'paste']) {
      window.addEventListener(type, (event) => {
        window.__seleniumClipboardTrace.push({
          type,
          key: event.key ?? null,
          code: event.code ?? null,
          ctrlKey: event.ctrlKey ?? null,
          isTrusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented,
          target: event.target instanceof HTMLElement ? `${event.target.tagName}.${event.target.className}` : String(event.target),
          active: document.activeElement instanceof HTMLElement
            ? `${document.activeElement.tagName}.${document.activeElement.className}`
            : String(document.activeElement),
          types: event.clipboardData ? [...event.clipboardData.types] : [],
        });
      });
    }
    window.addEventListener('cacablu:timeline-clipboard-paste', (event) => {
      window.__seleniumClipboardTrace.push({
        type: event.type,
        payloadBars: event.detail?.payload?.bars?.map((bar) => ({
          sourceId: bar.sourceId,
          layer: bar.layer,
          startTime: bar.startTime,
          endTime: bar.endTime,
        })) ?? [],
        playhead: document.querySelector('.timeline-panel__playhead span')?.textContent ?? null,
        selectedLayer: document.querySelector('.timeline-panel__lane.is-layer-selected')?.getAttribute('data-layer') ?? null,
        viewport: (() => {
          const viewport = document.querySelector('.timeline-panel__viewport');
          return viewport ? {
            scrollLeft: viewport.scrollLeft,
            clientWidth: viewport.clientWidth,
            scrollWidth: viewport.scrollWidth,
          } : null;
        })(),
      });
    });
  });
  await shortcut('o');
  await driver.wait(until.elementLocated(By.css('.timeline-panel__lane')), 30_000);
}

async function barCount() {
  return (await driver.findElements(By.css('.timeline-panel__clip'))).length;
}

async function waitForBarCount(expected, label) {
  try {
    await driver.wait(async () => await barCount() === expected, 15_000);
  } catch {
    throw new Error(`${label}: expected ${expected} bars, found ${await barCount()}.`);
  }
}

async function selectEmptyTailTarget() {
  const viewport = await driver.findElement(By.css('.timeline-panel__viewport'));
  await driver.executeScript((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    element.scrollTop = element.scrollHeight - element.clientHeight;
  }, viewport);
  const lanes = await driver.findElements(By.css('.timeline-panel__lane'));
  const lane = lanes.at(-1);
  const layer = await lane.getAttribute('data-layer');
  const [viewportRect, laneRect] = await Promise.all([viewport.getRect(), lane.getRect()]);
  await driver.actions().move({
    origin: Origin.VIEWPORT,
    x: Math.round(viewportRect.x + viewportRect.width * 0.72),
    y: Math.round(laneRect.y + laneRect.height / 2),
  }).click().perform();
  await driver.wait(async () => {
    const selected = await driver.findElements(By.css('.timeline-panel__lane.is-layer-selected'));
    return selected.length === 1 && await selected[0].getAttribute('data-layer') === layer;
  }, 10_000);
}

try {
  await openProject();
  const sourceBar = await driver.findElement(By.css('.timeline-panel__clip'));
  await sourceBar.click();
  await shortcut('c');
  const clipboardText = readWindowsClipboardText();
  if (!clipboardText.startsWith('Cacablu Timeline bars')) {
    throw new Error(`Selenium Ctrl+C did not publish a Timeline payload: ${JSON.stringify(clipboardText)}`);
  }

  const initialCount = await barCount();
  await selectEmptyTailTarget();
  await shortcut('v');
  await waitForBarCount(initialCount + 1, 'First same-project Selenium Ctrl+V');
  await selectEmptyTailTarget();
  await shortcut('v');
  await waitForBarCount(initialCount + 2, 'Repeated same-project Selenium Ctrl+V');

  const sourceHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow('tab');
  await openProject();
  const destinationCount = await barCount();
  await selectEmptyTailTarget();
  await shortcut('v');
  await waitForBarCount(destinationCount + 1, 'Cross-tab Selenium Ctrl+V');
  await driver.switchTo().window(sourceHandle);

  console.log(JSON.stringify({
    browser: 'Microsoft Edge',
    automation: 'Selenium WebDriver',
    project: projectPath,
    copyToWindowsClipboard: true,
    repeatedKeyboardPaste: true,
    crossTabKeyboardPaste: true,
  }, null, 2));
} catch (error) {
  let trace = [];
  let applicationEvents = [];
  try {
    trace = await driver.executeScript(() => window.__seleniumClipboardTrace ?? []);
    applicationEvents = await Promise.all(
      (await driver.findElements(By.css('.events-listbox__description'))).map((element) => element.getText()),
    );
  } catch {
    // The active page may already have closed after a driver failure.
  }
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    applicationEvents,
    trace,
  }, null, 2));
  throw error;
} finally {
  await driver.quit();
}
