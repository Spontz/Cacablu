/* global process, console, document, window, TextEncoder */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.setDefaultTimeout(5_000);
page.on('pageerror', (error) => console.error(`PAGE ERROR: ${error.message}`));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  console.log('STEP loaded');
  await page.evaluate(async () => {
    const [
      { createResourcesPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
      { createAssetClipboard },
    ] = await Promise.all([
      import('/src/panels/resources-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
      import('/src/resources/asset-clipboard.ts'),
    ]);

    const db = {
      variables: new Map(), bars: [], fbos: [], markers: [],
      folders: [{ id: 1, name: 'shaders', parent: 0, enabled: true }],
      files: [{
        id: 2, name: 'effect.glsl', parent: 1, bytes: 13, type: 'text/plain',
        data: new TextEncoder().encode('void main(){}'), format: 'glsl', enabled: true,
      }],
    };
    let nextId = 10;
    const item = (ref) => ref.kind === 'file'
      ? db.files.find((row) => row.id === ref.id)
      : db.folders.find((row) => row.id === ref.id);
    const descendants = (folderId) => {
      const ids = new Set([folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of db.folders) if (!ids.has(folder.id) && ids.has(folder.parent)) {
          ids.add(folder.id);
          changed = true;
        }
      }
      return ids;
    };
    const pathFor = (ref) => {
      const row = item(ref);
      if (!row) throw new Error('missing item');
      const parts = [row.name];
      let parent = row.parent;
      while (parent) {
        const folder = db.folders.find((candidate) => candidate.id === parent);
        if (!folder) break;
        parts.unshift(folder.name);
        parent = folder.parent;
      }
      return `/pool/${parts.join('/')}`;
    };
    const session = {
      fileName: 'fixture.sqlite', data: db,
      createResourceFolder(parent, rawName) {
        const name = rawName.trim();
        if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) throw new Error('Invalid folder name.');
        if ([...db.files, ...db.folders].some((row) => row.parent === parent && row.name.toLowerCase() === name.toLowerCase())) {
          throw new Error(`An item named ${name} already exists in this folder.`);
        }
        const folder = { id: nextId++, name, parent, enabled: true };
        db.folders.push(folder);
        return folder;
      },
      findResourceScriptReferences(ref) { return ref.kind === 'file' ? [{ barId: 99, occurrences: 2 }] : []; },
      renameResourceItem(ref, rawName) {
        const row = item(ref);
        if (!row) throw new Error('missing item');
        const oldName = row.name;
        const oldPath = pathFor(ref);
        row.name = rawName.trim();
        const newPath = pathFor(ref);
        const files = ref.kind === 'file'
          ? [{ file: row, oldPath, newPath }]
          : db.files.filter((file) => descendants(ref.id).has(file.parent)).map((file) => ({ file, newPath: pathFor({ kind: 'file', id: file.id }) }));
        return { item: ref, oldName, newName: row.name, oldPath, newPath, files, scripts: [] };
      },
      restoreResourceRename(mutation) {
        return this.renameResourceItem(mutation.item, mutation.oldName);
      },
      deleteResourceItems(roots) {
        const root = roots[0];
        const folderIds = root.kind === 'folder' ? descendants(root.id) : new Set();
        const folders = db.folders.flatMap((row, index) => folderIds.has(row.id) ? [{ row: { ...row }, index }] : []);
        const files = db.files.flatMap((row, index) => (root.kind === 'file' ? row.id === root.id : folderIds.has(row.parent))
          ? [{ row: { ...row, data: new Uint8Array(row.data) }, index, path: pathFor({ kind: 'file', id: row.id }) }]
          : []);
        db.folders = db.folders.filter((row) => !folderIds.has(row.id));
        db.files = db.files.filter((row) => !files.some((entry) => entry.row.id === row.id));
        session.data = db;
        return { roots, folders, files };
      },
      restoreResourceItems(snapshot) {
        for (const entry of snapshot.folders) db.folders.splice(entry.index, 0, entry.row);
        for (const entry of snapshot.files) db.files.splice(entry.index, 0, entry.row);
        return { operation: 'copy', roots: snapshot.roots, files: snapshot.files.map((entry) => ({ file: entry.row, newPath: entry.path })) };
      },
      moveResourceItems(roots, parentId) {
        const source = roots[0];
        if (!source || source.kind !== 'file') throw new Error('Expected a cut file.');
        const file = db.files.find((candidate) => candidate.id === source.id);
        if (!file) throw new Error('Missing cut file.');
        const oldPath = pathFor(source);
        file.parent = parentId;
        return {
          operation: 'move',
          roots: [{ kind: 'file', id: file.id }],
          files: [{ file, oldPath, newPath: pathFor(source) }],
        };
      },
      moveResourceItemsToParents(roots) {
        const source = roots[0];
        return this.moveResourceItems([{ kind: source.kind, id: source.id }], source.parentId);
      },
      setResourceFileEnabled(id, enabled) { const row = db.files.find((file) => file.id === id); row.enabled = enabled; return row; },
      async save() {}, async saveAs() { return this; }, close() {},
    };
    const state = createAppState();
    const dbState = createDbState();
    const undo = createUndoManager();
    const assetClipboard = createAssetClipboard();
    const connection = { isConnected: () => false, subscribeAssets: () => () => {} };
    const renderer = createResourcesPanel(state, dbState, { current: session }, connection, undo, assetClipboard);
    renderer.element.style.width = '320px';
    renderer.element.style.overflow = 'hidden';
    document.querySelector('#app').replaceChildren(renderer.element);
    renderer.init({});
    dbState.setOpen('fixture.sqlite');
    window.__itemActionsFixture = { assetClipboard, db, undo, state };
  });
  console.log('STEP fixture');

  const initialActionVisibility = await page.locator('.resources__actions-button').evaluateAll((buttons) => buttons.map((button) => ({
    label: button.getAttribute('aria-label'),
    opacity: window.getComputedStyle(button).opacity,
    visibility: window.getComputedStyle(button).visibility,
  })));
  if (initialActionVisibility.length !== 2
    || initialActionVisibility.some((button) => button.opacity !== '1' || button.visibility !== 'visible')) {
    throw new Error(`Root and folder ellipsis buttons are not permanently visible: ${JSON.stringify(initialActionVisibility)}`);
  }

  const rootActions = page.getByRole('button', { name: 'Actions for Pool root' });
  const rootButtonMetrics = await rootActions.evaluate((button) => {
    const buttonBounds = button.getBoundingClientRect();
    const rowBounds = button.closest('.resources__root-row').getBoundingClientRect();
    return {
      width: buttonBounds.width,
      height: buttonBounds.height,
      rightGap: rowBounds.right - buttonBounds.right,
      right: buttonBounds.right,
      bottom: buttonBounds.bottom,
    };
  });
  if (rootButtonMetrics.width > 18 || rootButtonMetrics.height > 18 || rootButtonMetrics.rightGap > 4.1) {
    throw new Error(`Root ellipsis button is not compact and right-aligned: ${JSON.stringify(rootButtonMetrics)}`);
  }
  await rootActions.click();
  const rootMenuMetrics = await page.getByRole('menu').evaluate((menu) => {
    const bounds = menu.getBoundingClientRect();
    const hitTarget = document.elementFromPoint(bounds.left + 4, bounds.top + 4);
    return {
      left: bounds.left,
      top: bounds.top,
      isDocumentOverlay: menu.parentElement === document.body,
      isVisibleAtPosition: Boolean(hitTarget && (hitTarget === menu || menu.contains(hitTarget))),
    };
  });
  if (!rootMenuMetrics.isDocumentOverlay || !rootMenuMetrics.isVisibleAtPosition) {
    throw new Error(`Root action menu is clipped by the Resources panel: ${JSON.stringify(rootMenuMetrics)}`);
  }
  const rootMenuGap = {
    horizontal: rootMenuMetrics.left - rootButtonMetrics.right,
    vertical: rootMenuMetrics.top - rootButtonMetrics.bottom,
  };
  if (rootMenuGap.horizontal < 0 || rootMenuGap.horizontal > 4 || rootMenuGap.vertical < 0 || rootMenuGap.vertical > 4) {
    throw new Error(`Root action menu did not open next to its button: ${JSON.stringify(rootMenuGap)}`);
  }
  console.log('STEP root menu');
  const rootMenuLabels = await page.getByRole('menu').getByRole('menuitem').allTextContents();
  if (rootMenuLabels.join('|') !== 'New Folder|Paste') throw new Error(`Unexpected root menu: ${rootMenuLabels.join(', ')}`);
  const rootMenuIconCount = await page.getByRole('menu').locator('[role="menuitem"] > .menu-icon[aria-hidden="true"][focusable="false"]').count();
  if (rootMenuIconCount !== rootMenuLabels.length) throw new Error('Root menu actions do not all have decorative icons.');
  const rootMenuStructure = await page.getByRole('menu').locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') === 'separator' ? 'separator' : element.textContent
  )));
  if (rootMenuStructure.join('|') !== 'New Folder|separator|Paste') {
    throw new Error(`Unexpected root menu separators: ${rootMenuStructure.join(', ')}`);
  }
  await page.getByRole('menuitem', { name: 'New Folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('materials');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('[data-resource-kind="folder"]', { hasText: 'materials' }).waitFor();
  console.log('STEP folder created');
  await page.evaluate(() => window.__itemActionsFixture.undo.undo());
  await page.locator('[data-resource-kind="folder"]', { hasText: 'materials' }).waitFor({ state: 'detached' });

  await rootActions.click();
  await page.getByRole('menuitem', { name: 'New Folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('materials');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('[data-resource-kind="folder"]', { hasText: 'materials' }).waitFor();
  await rootActions.click();
  await page.getByRole('menuitem', { name: 'New Folder' }).click();
  await page.getByRole('textbox', { name: 'Folder name' }).fill('MATERIALS');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('alert').filter({ hasText: 'already exists' }).waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const folderActions = page.getByRole('button', { name: 'Actions for folder shaders' });
  await folderActions.click();
  const firstClickState = await page.evaluate(() => window.__itemActionsFixture.state.getSnapshot().assetSelection);
  if (firstClickState.kind !== 'folder' || firstClickState.id !== 1 || await page.locator('[data-resource-kind="file"]').count() !== 0) {
    throw new Error(`First ellipsis click did not select without expanding: ${JSON.stringify(firstClickState)}`);
  }
  const folderMenuLabels = await page.getByRole('menu').getByRole('menuitem').allTextContents();
  if (folderMenuLabels.join('|') !== 'New Folder|Cut|Copy|Paste|Rename|Delete') throw new Error(`Unexpected folder menu: ${folderMenuLabels.join(', ')}`);
  const folderMenuIconCount = await page.getByRole('menu').locator('[role="menuitem"] > .menu-icon[aria-hidden="true"][focusable="false"]').count();
  if (folderMenuIconCount !== folderMenuLabels.length) throw new Error('Folder menu actions do not all have decorative icons.');
  const folderMenuStructure = await page.getByRole('menu').locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') === 'separator' ? 'separator' : element.textContent
  )));
  if (folderMenuStructure.join('|') !== 'New Folder|separator|Cut|Copy|Paste|Rename|separator|Delete') {
    throw new Error(`Unexpected folder menu separators: ${folderMenuStructure.join(', ')}`);
  }
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renameInput = page.getByRole('textbox', { name: 'New name' });
  await renameInput.fill('fx');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.locator('[data-resource-kind="folder"]', { hasText: 'fx' }).waitFor();
  console.log('STEP renamed');

  await page.getByRole('button', { name: 'Actions for folder fx' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.waitForTimeout(50);
  if (await page.locator('[data-resource-kind="folder"]', { hasText: 'fx' }).count()) throw new Error('Folder was not deleted.');
  await page.evaluate(() => window.__itemActionsFixture.undo.undo());
  await page.locator('[data-resource-kind="folder"]', { hasText: 'fx' }).waitFor();
  console.log('STEP restored');

  await page.locator('[data-resource-kind="folder"]', { hasText: 'fx' }).click();
  const fileRow = page.locator('[data-resource-kind="file"]', { hasText: 'effect.glsl' });
  const fileActions = fileRow.getByRole('button', { name: 'Actions for file effect.glsl' });
  const fileActionVisibility = await fileActions.evaluate((button) => ({
    opacity: window.getComputedStyle(button).opacity,
    visibility: window.getComputedStyle(button).visibility,
  }));
  if (fileActionVisibility.opacity !== '1' || fileActionVisibility.visibility !== 'visible') {
    throw new Error(`File ellipsis button is not permanently visible: ${JSON.stringify(fileActionVisibility)}`);
  }
  await fileActions.click();
  const fileMenuLabels = await page.getByRole('menu').getByRole('menuitem').allTextContents();
  if (fileMenuLabels.join('|') !== 'Cut|Copy|Rename|Delete') throw new Error(`Unexpected file menu: ${fileMenuLabels.join(', ')}`);
  const fileMenuIconCount = await page.getByRole('menu').locator('[role="menuitem"] > .menu-icon[aria-hidden="true"][focusable="false"]').count();
  if (fileMenuIconCount !== fileMenuLabels.length) throw new Error('File menu actions do not all have decorative icons.');
  const fileMenuStructure = await page.getByRole('menu').locator(':scope > *').evaluateAll((elements) => elements.map((element) => (
    element.getAttribute('role') === 'separator' ? 'separator' : element.textContent
  )));
  if (fileMenuStructure.join('|') !== 'Cut|Copy|Rename|separator|Delete') {
    throw new Error(`Unexpected file menu separators: ${fileMenuStructure.join(', ')}`);
  }
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'New name' }).fill('cancelled.glsl');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  if (await page.locator('[data-resource-kind="file"]', { hasText: 'cancelled.glsl' }).count()) throw new Error('Cancelled rename changed the file.');

  await fileRow.getByRole('button', { name: 'Actions for file effect.glsl' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'New name' }).fill('kept.glsl');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('button', { name: 'Rename and Keep Script Paths' }).click();
  await page.locator('[data-resource-kind="file"]', { hasText: 'kept.glsl' }).waitFor();
  await page.evaluate(() => window.__itemActionsFixture.undo.undo());
  await fileRow.waitFor();

  await fileRow.getByRole('button', { name: 'Actions for file effect.glsl' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByRole('textbox', { name: 'New name' }).fill('effect-fixed.glsl');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByText('2 matching script references found.').waitFor();
  await page.getByRole('button', { name: 'Rename and Update Script Paths' }).click();
  const fixedFileRow = page.locator('[data-resource-kind="file"]', { hasText: 'effect-fixed.glsl' });
  await fixedFileRow.waitFor();

  const fixedFileActions = fixedFileRow.getByRole('button', { name: 'Actions for file effect-fixed.glsl' });
  await fixedFileActions.click();
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  const copiedSnapshot = await page.evaluate(() => {
    const snapshot = window.__itemActionsFixture.assetClipboard.getSnapshot();
    return snapshot ? { operation: snapshot.operation, sourceId: snapshot.roots[0]?.sourceId } : null;
  });
  if (copiedSnapshot?.operation !== 'copy' || copiedSnapshot.sourceId !== 2) {
    throw new Error(`Menu Copy did not capture its file target: ${JSON.stringify(copiedSnapshot)}`);
  }

  await fixedFileActions.click();
  await page.getByRole('menuitem', { name: 'Cut' }).click();
  await fixedFileRow.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-resource-kind="file"]')?.classList.contains('is-cut-pending'));
  await rootActions.click();
  await page.getByRole('menuitem', { name: 'Paste' }).click();
  await page.waitForFunction(() => {
    const fixture = window.__itemActionsFixture;
    return fixture.db.files.find((file) => file.id === 2)?.parent === 0
      && fixture.assetClipboard.getSnapshot() === null;
  });
  console.log('STEP clipboard menu');

  console.log(JSON.stringify({
    rootMenuLabels,
    folderMenuLabels,
    folderMenuIconCount,
    folderMenuStructure,
    fileMenuLabels,
    fileMenuIconCount,
    fileMenuStructure,
    firstClickState,
    initialActionVisibility,
    fileActionVisibility,
    rootButtonMetrics,
    rootMenuGap,
    rootMenuIconCount,
    rootMenuStructure,
    clipboardMenu: true,
    restored: true,
    renameChoice: true,
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
