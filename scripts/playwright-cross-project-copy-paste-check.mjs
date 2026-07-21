/* global process, console, window, File, document, navigator, Buffer, getComputedStyle, HTMLElement, atob */

import { access, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import initSqlJs from 'sql.js';

const projectPath = process.env.CACABLU_PROJECT_PATH;
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
if (projectPath) await access(projectPath);

async function createFixtureProject() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run('CREATE TABLE "variables" ("variable" TEXT PRIMARY KEY, "value" TEXT)');
  db.run('CREATE TABLE "BARS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "type" TEXT, "layer" INTEGER, "startTime" REAL, "endTime" REAL, "enabled" INTEGER, "selected" INTEGER, "script" TEXT, "srcBlending" TEXT, "dstBlending" TEXT, "blendingEQ" TEXT, "srcAlpha" TEXT, "dstAlpha" TEXT)');
  db.run('CREATE TABLE "FBOs" ("id" INTEGER PRIMARY KEY, "ratio" INTEGER, "width" INTEGER, "height" INTEGER, "format" TEXT, "colorAttachments" INTEGER, "filter" TEXT)');
  db.run('CREATE TABLE "FILES" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "bytes" INTEGER, "type" TEXT, "data" BLOB, "format" TEXT, "enabled" INTEGER)');
  db.run('CREATE TABLE "FOLDERS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "enabled" INTEGER)');
  const bytes = db.export();
  db.close();
  return Buffer.from(bytes);
}

const fixtureProject = projectPath ? await readFile(projectPath) : await createFixtureProject();
const fixtureProjectBase64 = fixtureProject.toString('base64');

const browser = await chromium.launch({
  headless: process.env.CACABLU_HEADLESS !== 'false',
  ...(process.env.CACABLU_BROWSER_CHANNEL
    ? { channel: process.env.CACABLU_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  permissions: ['clipboard-read', 'clipboard-write'],
  viewport: { width: 1400, height: 900 },
});
const source = await context.newPage();
const destination = await context.newPage();
for (const page of [source, destination]) {
  page.setDefaultTimeout(30_000);
  page.on('pageerror', (error) => console.error(`PAGE ERROR: ${error.message}`));
  await page.route('**/__cross_project.sqlite', (route) => route.fulfill({
    ...(projectPath ? { path: projectPath } : { body: fixtureProject }),
    contentType: 'application/x-sqlite3',
  }));
}

async function installProjectPicker(page, name) {
  await page.addInitScript(({ projectName, projectBase64 }) => {
    const projectBytes = Uint8Array.from(atob(projectBase64), (character) => character.charCodeAt(0));
    const createHandle = () => ({
      kind: 'file',
      name: projectName,
      getFile: async () => new File(
        [projectBytes],
        projectName,
        { type: 'application/x-sqlite3' },
      ),
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    });
    window.showOpenFilePicker = async () => [createHandle()];
    window.showSaveFilePicker = async () => createHandle();
  }, { projectName: name, projectBase64: fixtureProjectBase64 });
}

async function openProject(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+O');
  await page.locator('.timeline-panel__lane').first().waitFor({ state: 'visible' });
}

async function createBar(page) {
  await page.locator('.dv-tab', { hasText: 'Timeline' }).click();
  const existing = page.locator('.timeline-panel__clip');
  if (await existing.count()) {
    const first = existing.first();
    await first.click();
    await first.waitFor();
    return;
  }
  const viewport = page.locator('.timeline-panel__viewport');
  const lane = page.locator('.timeline-panel__lane').first();
  const [viewportBox, laneBox] = await Promise.all([viewport.boundingBox(), lane.boundingBox()]);
  if (!viewportBox || !laneBox) throw new Error('Timeline is not visible.');
  const y = laneBox.y + laneBox.height / 2;
  const startX = viewportBox.x + Math.min(420, viewportBox.width * 0.55);
  const endX = startX + 90;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 8 });
  await page.mouse.up();
  const selected = page.locator('.timeline-panel__clip.is-selected');
  await selected.waitFor();
  await selected.click();
}

async function selectPasteTarget(page) {
  await page.locator('.dv-tab', { hasText: 'Timeline' }).click();
  const viewport = page.locator('.timeline-panel__viewport');
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await page.waitForTimeout(100);
  const lanes = page.locator('.timeline-panel__lane');
  const target = lanes.nth(Math.min(2, (await lanes.count()) - 1));
  const [viewportBox, laneBox] = await Promise.all([viewport.boundingBox(), target.boundingBox()]);
  if (!viewportBox || !laneBox) throw new Error('Timeline paste target is not visible.');
  await page.waitForTimeout(250);
  await page.mouse.click(
    viewportBox.x + viewportBox.width * 0.65,
    laneBox.y + laneBox.height / 2,
  );
  await target.waitFor({ state: 'visible' });
  if (!(await target.evaluate((lane) => lane.classList.contains('is-paste-target')))) {
    const debug = await page.locator('.timeline-panel__lane').evaluateAll((items) => items.map((item) => ({
      layer: item.getAttribute('data-layer'),
      classes: item.className,
    })));
    throw new Error(`The clicked Timeline lane was not selected as the paste target: ${JSON.stringify(debug)}`);
  }
}

async function runEditMenuAction(page, label) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('.menu-bar__item', { hasText: label }).click();
}

async function createBarInHorizontalTail(page) {
  await page.locator('.dv-tab', { hasText: 'Timeline' }).click();
  const viewport = page.locator('.timeline-panel__viewport');
  const before = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  if (before.scrollWidth < before.clientWidth * 2) {
    throw new Error(`Timeline has no viewport-sized horizontal tail: ${JSON.stringify(before)}`);
  }

  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await page.waitForTimeout(100);
  const lane = page.locator('.timeline-panel__lane').first();
  const [viewportBox, laneBox] = await Promise.all([viewport.boundingBox(), lane.boundingBox()]);
  if (!viewportBox || !laneBox) throw new Error('Timeline horizontal tail is not visible.');
  const y = laneBox.y + laneBox.height / 2;
  const startX = viewportBox.x + viewportBox.width * 0.3;
  const endX = startX + Math.min(100, viewportBox.width * 0.18);
  const previousCount = await page.locator('.timeline-panel__clip').count();
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    previousCount,
  );

  const created = await page.locator('.timeline-panel__clip.is-selected').evaluate((clip) => {
    const laneElement = clip.closest('.timeline-panel__lane');
    const clipLeft = Number.parseFloat((clip).style.left);
    const clipWidth = clip.getBoundingClientRect().width;
    const timelineViewport = clip.closest('.timeline-panel__viewport');
    return {
      clipLeft,
      clipWidth,
      scrollWidth: timelineViewport?.scrollWidth ?? 0,
      clientWidth: timelineViewport?.clientWidth ?? 0,
      selectedLayer: laneElement?.classList.contains('is-layer-selected') ?? false,
      background: laneElement ? getComputedStyle(laneElement).backgroundColor : '',
    };
  });
  const previousContentEnd = before.scrollWidth - before.clientWidth;
  if (
    created.clipLeft <= previousContentEnd
    || created.scrollWidth < created.clipLeft + created.clipWidth + created.clientWidth - 2
  ) {
    throw new Error(`Bar creation did not extend the horizontal tail: ${JSON.stringify({ before, created })}`);
  }
  return created;
}

try {
  await installProjectPicker(source, 'source-project.sqlite');
  await installProjectPicker(destination, 'destination-project.sqlite');
  await Promise.all([openProject(source), openProject(destination)]);

  await createBar(source);
  const sourceSelectedLayer = await source.locator('.timeline-panel__clip.is-selected').evaluate((clip) => {
    const lane = clip.closest('.timeline-panel__lane');
    return {
      selected: lane?.classList.contains('is-layer-selected') ?? false,
      background: lane ? getComputedStyle(lane).backgroundColor : '',
    };
  });
  if (!sourceSelectedLayer.selected || !sourceSelectedLayer.background.startsWith('rgba(255, 200, 28')) {
    throw new Error(`Clicking a bar did not select its layer in yellow: ${JSON.stringify(sourceSelectedLayer)}`);
  }
  await source.locator('.dv-tab', { hasText: 'Pool' }).click();
  await source.evaluate(() => {
    window.__timelineCopyDebug = [];
    document.addEventListener('copy', (event) => {
      window.__timelineCopyDebug.push({
        target: event.target instanceof HTMLElement ? `${event.target.tagName}.${event.target.className}` : String(event.target),
        targetHtml: event.target instanceof HTMLElement ? event.target.outerHTML : '',
        editableAncestor: event.target instanceof HTMLElement
          ? event.target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor')?.outerHTML.slice(0, 300) ?? null
          : null,
        active: document.activeElement instanceof HTMLElement
          ? `${document.activeElement.tagName}.${document.activeElement.className}`
          : String(document.activeElement),
        types: event.clipboardData ? [...event.clipboardData.types] : [],
      });
    });
    window.addEventListener('copy', (event) => {
      window.__timelineCopyDebug.push({
        windowListener: true,
        types: event.clipboardData ? [...event.clipboardData.types] : [],
      });
    });
  });
  await source.keyboard.press('Control+C');
  const clipboardAfterBarCopy = await source.evaluate(async () => ({
    text: await navigator.clipboard.readText(),
    types: (await navigator.clipboard.read()).flatMap((item) => item.types),
    active: document.activeElement instanceof HTMLElement
      ? `${document.activeElement.tagName}.${document.activeElement.className}`
      : String(document.activeElement),
    selected: document.querySelectorAll('.timeline-panel__clip.is-selected').length,
    copyEvents: window.__timelineCopyDebug,
  }));
  if (!clipboardAfterBarCopy.text.startsWith('Cacablu Timeline bars')) {
    throw new Error(`Timeline Copy did not publish a rich payload: ${JSON.stringify(clipboardAfterBarCopy)}`);
  }
  const sameProjectBarsBefore = await source.locator('.timeline-panel__clip').count();
  await selectPasteTarget(source);
  await source.keyboard.press('Control+V');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    sameProjectBarsBefore,
  );
  await selectPasteTarget(source);
  await source.keyboard.press('Control+V');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 2,
    sameProjectBarsBefore,
  );
  await source.keyboard.press('Control+Z');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    sameProjectBarsBefore,
  );
  await source.keyboard.press('Control+Z');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count,
    sameProjectBarsBefore,
  );
  await source.locator('.timeline-panel__clip').first().click();
  await runEditMenuAction(source, 'Copy');
  const menuPasteBarsBefore = await source.locator('.timeline-panel__clip').count();
  await selectPasteTarget(source);
  await runEditMenuAction(source, 'Paste');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    menuPasteBarsBefore,
  );
  await source.keyboard.press('Control+Z');
  await source.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count,
    menuPasteBarsBefore,
  );
  const destinationBarsBefore = await destination.locator('.timeline-panel__clip').count();
  await source.locator('.timeline-panel__clip').first().click();
  await source.keyboard.press('Control+C');
  await selectPasteTarget(destination);
  await destination.keyboard.press('Control+V');
  await destination.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count + 1,
    destinationBarsBefore,
  );
  const pastedIds = await destination.locator('.timeline-panel__clip.is-selected').evaluateAll((clips) => (
    clips.map((clip) => Number(clip.getAttribute('data-bar-id')))
  ));
  if (pastedIds.length !== 1 || !Number.isInteger(pastedIds[0])) {
    throw new Error(`Timeline paste selection is invalid: ${JSON.stringify(pastedIds)}`);
  }
  await destination.keyboard.press('Control+Z');
  await destination.waitForFunction(
    (count) => document.querySelectorAll('.timeline-panel__clip').length === count,
    destinationBarsBefore,
  );
  const horizontalTailBar = await createBarInHorizontalTail(destination);

  const folderName = `__cross_tab_${Date.now()}__`;
  await source.locator('.dv-tab', { hasText: 'Pool' }).click();
  const sourceRootActions = source.getByRole('button', { name: 'Actions for Pool root' });
  await sourceRootActions.click();
  await source.getByRole('menuitem', { name: 'New Folder' }).click();
  await source.getByRole('textbox', { name: 'Folder name' }).fill(folderName);
  await source.getByRole('button', { name: 'Create' }).click();
  const sourceFolder = source.locator('[data-resource-kind="folder"]', { hasText: folderName });
  await sourceFolder.waitFor();
  await sourceFolder.getByRole('button', { name: /Actions for folder/ }).click();
  await source.getByRole('menuitem', { name: 'Copy' }).click();
  await source.close();

  await destination.locator('.dv-tab', { hasText: 'Pool' }).click();
  const destinationRoot = destination.locator('.resources__root-row');
  await destinationRoot.click();
  await destination.keyboard.press('Control+V');
  const destinationFolder = destination.locator('[data-resource-kind="folder"]', { hasText: folderName });
  await destinationFolder.waitFor();
  await destination.keyboard.press('Control+Z');
  await destinationFolder.waitFor({ state: 'detached' });

  console.log(JSON.stringify({
    timelineMenuCopyPaste: true,
    timelineCopyAfterNonEditableFocusDrift: true,
    timelineRepeatedKeyboardPaste: true,
    timelineSameProjectPaste: true,
    timelineCrossTabPaste: true,
    timelineLayerTarget: true,
    yellowLayerBehindBar: sourceSelectedLayer.selected,
    horizontalTailBarCreation: horizontalTailBar.clipLeft > 0,
    timelineUndo: true,
    poolCrossTabPaste: true,
    poolUndo: true,
  }, null, 2));
} finally {
  await browser.close();
}
