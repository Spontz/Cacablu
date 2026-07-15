/* global process, console, document, window, File, atob, Buffer */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { chromium } from 'playwright';

const sqlitePath = process.env.CACABLU_SQLITE_PATH;
if (!sqlitePath) throw new Error('Set CACABLU_SQLITE_PATH to a real Cacablu SQLite project.');
const encoded = Buffer.from(await readFile(sqlitePath)).toString('base64');
const name = basename(sqlitePath);
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.setDefaultTimeout(15_000);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ encodedProject, projectName }) => {
    const [
      { openDbSession }, { createResourcesPanel }, { createAppState }, { createDbState },
      { createUndoManager }, { createAssetClipboard },
    ] = await Promise.all([
      import('/src/db/db-session.ts'),
      import('/src/panels/resources-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
      import('/src/resources/asset-clipboard.ts'),
    ]);
    const binary = atob(encodedProject);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const handle = {
      name: projectName,
      kind: 'file',
      async getFile() { return new File([bytes], projectName, { type: 'application/x-sqlite3' }); },
      async createWritable() { return { async write() {}, async close() {} }; },
    };
    const session = await openDbSession(handle);
    const state = createAppState();
    const dbState = createDbState();
    const undo = createUndoManager();
    const renderer = createResourcesPanel(
      state,
      dbState,
      { current: session },
      { isConnected: () => false, subscribeAssets: () => () => {} },
      undo,
      createAssetClipboard(),
    );
    document.querySelector('#app').replaceChildren(renderer.element);
    renderer.init({});
    dbState.setOpen(projectName);
    window.__realItemActions = { session, state, undo };
  }, { encodedProject: encoded, projectName: name });

  const rootButton = page.getByRole('button', { name: 'Actions for Pool root' });
  await rootButton.click();
  await page.getByRole('menuitem', { name: 'New Folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('__playwright_actions__');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('[data-resource-kind="folder"]', { hasText: '__playwright_actions__' }).waitFor();
  await page.evaluate(() => window.__realItemActions.undo.undo());
  await page.locator('[data-resource-kind="folder"]', { hasText: '__playwright_actions__' }).waitFor({ state: 'detached' });

  const firstFolder = page.locator('[data-resource-kind="folder"]').first();
  if (await firstFolder.count()) {
    const action = firstFolder.getByRole('button', { name: /Actions for folder/ });
    await action.click();
    const actions = await page.getByRole('menu').getByRole('menuitem').allTextContents();
    if (actions.join('|') !== 'New Folder|Rename|Delete') throw new Error(`Unexpected real folder menu: ${actions.join(', ')}`);
  }

  console.log(JSON.stringify(await page.evaluate(() => ({
    fileName: window.__realItemActions.session.fileName,
    folders: window.__realItemActions.session.data.folders.length,
    files: window.__realItemActions.session.data.files.length,
    canUndo: window.__realItemActions.undo.canUndo(),
  })), null, 2));
} finally {
  await browser.close();
}
