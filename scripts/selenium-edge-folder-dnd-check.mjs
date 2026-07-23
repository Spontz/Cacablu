/* global process, console, window, document, File, Buffer, atob */

import { Builder, By, Key, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';
import initSqlJs from 'sql.js';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://localhost:5173/';
const SQL = await initSqlJs();

function createFixtureProject() {
  const db = new SQL.Database();
  db.run('CREATE TABLE "variables" ("variable" TEXT PRIMARY KEY, "value" TEXT)');
  db.run('CREATE TABLE "BARS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "type" TEXT, "layer" INTEGER, "startTime" REAL, "endTime" REAL, "enabled" INTEGER, "selected" INTEGER, "script" TEXT, "srcBlending" TEXT, "dstBlending" TEXT, "blendingEQ" TEXT, "srcAlpha" TEXT, "dstAlpha" TEXT)');
  db.run('CREATE TABLE "FBOs" ("id" INTEGER PRIMARY KEY, "ratio" INTEGER, "width" INTEGER, "height" INTEGER, "format" TEXT, "colorAttachments" INTEGER, "filter" TEXT)');
  db.run('CREATE TABLE "FILES" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "bytes" INTEGER, "type" TEXT, "data" BLOB, "format" TEXT, "enabled" INTEGER)');
  db.run('CREATE TABLE "FOLDERS" ("id" INTEGER PRIMARY KEY, "name" TEXT, "parent" INTEGER, "enabled" INTEGER)');
  db.run('INSERT INTO "FOLDERS" VALUES (1, ?, 0, 1)', ['source-folder']);
  db.run('INSERT INTO "FOLDERS" VALUES (2, ?, 0, 1)', ['target-folder']);
  db.run('INSERT INTO "FILES" VALUES (10, ?, 1, 3, ?, ?, ?, 1)', ['child.txt', 'text/plain', new Uint8Array([65, 66, 67]), 'txt']);
  const bytes = db.export();
  db.close();
  return bytes;
}

const fixtureBase64 = Buffer.from(createFixtureProject()).toString('base64');
const driver = await new Builder()
  .forBrowser('MicrosoftEdge')
  .setEdgeOptions(new edge.Options().addArguments('--start-maximized'))
  .build();

try {
  await driver.get(baseUrl);
  await driver.executeScript((base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const handle = {
      kind: 'file',
      name: 'folder-dnd.sqlite',
      getFile: async () => new File([bytes], 'folder-dnd.sqlite', { type: 'application/x-sqlite3' }),
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
      isSameEntry: async () => true,
    };
    window.showOpenFilePicker = async () => [handle];
    window.showSaveFilePicker = async () => handle;
  }, fixtureBase64);
  await driver.actions().keyDown(Key.CONTROL).sendKeys('o').keyUp(Key.CONTROL).perform();

  const sourceSelector = '[data-resource-kind="folder"][data-resource-id="1"]';
  const targetSelector = '[data-resource-kind="folder"][data-resource-id="2"]';
  const source = await driver.wait(until.elementLocated(By.css(sourceSelector)), 30_000);
  const target = await driver.findElement(By.css(targetSelector));

  await driver.actions({ async: true })
    .move({ origin: source })
    .press()
    .move({ origin: target, duration: 800 })
    .release()
    .perform();

  await driver.sleep(250);
  await driver.findElement(By.css(targetSelector)).click();
  const nestedSelector = `[data-folder-id="2"] ${sourceSelector}`;
  await driver.wait(until.elementLocated(By.css(nestedSelector)), 5_000).catch(async () => {
    const diagnostics = await driver.executeScript((sourceQuery, targetQuery) => {
      const sourceRow = document.querySelector(sourceQuery);
      const targetRow = document.querySelector(targetQuery);
      return {
        sourceDraggable: sourceRow?.getAttribute('draggable') ?? null,
        sourceParentFolder: sourceRow?.closest('.resources__folder')?.parentElement?.closest('.resources__folder')?.dataset.folderId ?? null,
        targetExpanded: targetRow?.querySelector('.resources__disclosure')?.getAttribute('data-expanded') ?? null,
      };
    }, sourceSelector, targetSelector);
    throw new Error(`Native Edge folder drag did not move the folder: ${JSON.stringify(diagnostics)}`);
  });

  console.log(JSON.stringify({ browser: 'Microsoft Edge', automation: 'Selenium WebDriver', folderMoved: true }, null, 2));
} finally {
  await driver.quit();
}
