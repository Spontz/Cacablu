/* global process, console, window, File, document, atob, URL, HTMLElement, KeyboardEvent, ClipboardEvent, queueMicrotask */

import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectPath = process.env.CACABLU_PROJECT_PATH;
if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a Cacablu SQLite project.');
await access(projectPath);

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://localhost:5173/';
const projectBase64 = (await readFile(projectPath)).toString('base64');
const windowTitle = `CACABLU_EDGE_CLIPBOARD_${process.pid}`;
const windowsSendKeysScript = fileURLToPath(new URL('./windows-send-keys.ps1', import.meta.url));
const browser = await chromium.launch({
  channel: process.env.CACABLU_BROWSER_CHANNEL ?? 'msedge',
  headless: false,
});
// Intentionally do not grant clipboard-read or clipboard-write. Keyboard
// clipboard events must work with Edge's normal trusted user gesture.
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const source = await context.newPage();
const destination = await context.newPage();

for (const page of [source, destination]) {
  page.setDefaultTimeout(30_000);
  page.on('pageerror', (error) => console.error(`PAGE ERROR: ${error.message}`));
  await page.addInitScript(({ name, base64 }) => {
    window.__clipboardTrace = [];
    const describeTarget = (target) => target instanceof HTMLElement
      ? `${target.tagName}.${target.className}`
      : String(target);
    for (const type of ['keydown', 'copy', 'paste']) {
      window.addEventListener(type, (event) => {
        const record = () => window.__clipboardTrace.push({
          type,
          key: event instanceof KeyboardEvent ? event.key : null,
          code: event instanceof KeyboardEvent ? event.code : null,
          ctrlKey: event instanceof KeyboardEvent ? event.ctrlKey : null,
          isTrusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented,
          target: describeTarget(event.target),
          active: describeTarget(document.activeElement),
          types: event instanceof ClipboardEvent && event.clipboardData
            ? [...event.clipboardData.types]
            : [],
        });
        record();
        queueMicrotask(record);
      }, true);
    }
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
  }, { name: projectPath.split(/[\\/]/).at(-1), base64: projectBase64 });
}

async function sendWindowsShortcut(page, keys) {
  await page.bringToFront();
  await page.evaluate((title) => { document.title = title; }, windowTitle);
  await page.waitForTimeout(150);
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', windowsSendKeysScript,
    '-WindowTitle', windowTitle,
    '-Keys', keys,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Windows could not send ${keys}: ${result.stderr || result.stdout}`);
  }
  await page.waitForTimeout(200);
}

function readWindowsClipboardText() {
  const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command', 'Get-Clipboard -Raw',
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not read the Windows clipboard: ${result.stderr}`);
  return result.stdout;
}

async function openProject(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+O');
  await page.locator('.timeline-panel__lane').first().waitFor({ state: 'visible' });
}

async function selectSourceBar(page) {
  const bar = page.locator('.timeline-panel__clip').first();
  await bar.waitFor({ state: 'visible' });
  await bar.click();
  await page.locator('.timeline-panel__clip.is-selected').waitFor({ state: 'visible' });
}

async function selectEmptyTailTarget(page, laneIndex) {
  await page.locator('.dv-tab', { hasText: 'Timeline' }).click();
  const viewport = page.locator('.timeline-panel__viewport');
  await viewport.evaluate((element) => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
  await page.waitForTimeout(100);
  const lanes = page.locator('.timeline-panel__lane');
  const laneCount = await lanes.count();
  const lane = lanes.nth(Math.min(laneIndex, laneCount - 1));
  const layer = await lane.getAttribute('data-layer');
  const [viewportBox, laneBox] = await Promise.all([viewport.boundingBox(), lane.boundingBox()]);
  if (!viewportBox || !laneBox) throw new Error('The Timeline target is not visible.');
  await page.mouse.click(viewportBox.x + viewportBox.width * 0.72, laneBox.y + laneBox.height / 2);
  await page.waitForFunction(
    (expectedLayer) => document.querySelector('.timeline-panel__lane.is-layer-selected')?.getAttribute('data-layer') === expectedLayer,
    layer,
  );
}

function assertPlainTextReachedSystemClipboard() {
  const text = readWindowsClipboardText();
  if (!text.startsWith('Cacablu Timeline bars')) {
    throw new Error(`Ctrl+C did not publish the Timeline payload to the system clipboard: ${JSON.stringify(text)}`);
  }
}

async function assertEditableClipboardRemainsNative(page) {
  await page.evaluate(() => {
    const input = document.createElement('textarea');
    input.dataset.editableClipboardProbe = 'true';
    input.value = 'native Edge text clipboard';
    document.body.append(input);
    input.focus();
    input.select();
  });
  await sendWindowsShortcut(page, '^c');
  const probe = page.locator('[data-editable-clipboard-probe="true"]');
  await probe.fill('');
  await sendWindowsShortcut(page, '^v');
  const text = await probe.inputValue();
  await probe.evaluate((element) => element.remove());
  if (text !== 'native Edge text clipboard') {
    throw new Error(`Cacablu intercepted an editable text clipboard operation: ${JSON.stringify(text)}`);
  }
}

try {
  await Promise.all([openProject(source), openProject(destination)]);

  await assertEditableClipboardRemainsNative(source);

  // Literal reported sequence in one project: bar, Ctrl+C, empty lane, Ctrl+V.
  await selectSourceBar(source);
  await sendWindowsShortcut(source, '^c');
  assertPlainTextReachedSystemClipboard();
  const sourceCount = await source.locator('.timeline-panel__clip').count();
  await selectEmptyTailTarget(source, 2);
  await sendWindowsShortcut(source, '^v');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    sourceCount,
  );

  // The same payload must remain reusable at a second destination.
  await selectEmptyTailTarget(source, 3);
  await sendWindowsShortcut(source, '^v');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 2,
    sourceCount,
  );
  await sendWindowsShortcut(source, '^z');
  await sendWindowsShortcut(source, '^z');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count,
    sourceCount,
  );

  // A separate tab has no in-memory snapshot and therefore proves that the
  // system clipboard contains the self-contained rich payload.
  const destinationCount = await destination.locator('.timeline-panel__clip').count();
  await selectEmptyTailTarget(destination, 2);
  await sendWindowsShortcut(destination, '^v');
  await destination.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    destinationCount,
  );

  console.log(JSON.stringify({
    browser: 'Microsoft Edge',
    keyboardInput: 'Windows SendKeys',
    clipboardPermissionsGranted: false,
    project: projectPath,
    literalKeyboardSequence: true,
    repeatedKeyboardPaste: true,
    crossTabKeyboardPaste: true,
    undo: true,
    editableTextClipboard: true,
  }, null, 2));
} catch (error) {
  const traces = await Promise.all([source, destination].map(async (page) => {
    try {
      return await page.evaluate(() => window.__clipboardTrace ?? []);
    } catch {
      return [];
    }
  }));
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error), traces }, null, 2));
  throw error;
} finally {
  await browser.close();
}
