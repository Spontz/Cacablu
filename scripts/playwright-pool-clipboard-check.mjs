/* global process, console, document, navigator, window, TextEncoder, DataTransfer */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [
      monaco,
      { createResourcesPanel },
      { createAppState },
      { createDbState },
      { createAssetClipboard },
      { installPoolPathDrop },
    ] = await Promise.all([
      import('/node_modules/monaco-editor/esm/vs/editor/editor.api.js'),
      import('/src/panels/resources-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/resources/asset-clipboard.ts'),
      import('/src/resources/pool-path-drop.ts'),
    ]);
    const root = document.querySelector('#app');
    if (!root) throw new Error('Missing application root.');

    const db = {
      variables: new Map(),
      bars: [],
      fbos: [],
      folders: [{ id: 1, name: 'shaders', parent: 0, enabled: true }],
      files: [
        {
          id: 10,
          name: 'scene.glsl',
          parent: 1,
          bytes: 13,
          type: 'text/plain',
          data: new TextEncoder().encode('void main(){}'),
          format: 'glsl',
          enabled: true,
        },
        {
          id: 11,
          name: 'move.txt',
          parent: 1,
          bytes: 4,
          type: 'text/plain',
          data: new TextEncoder().encode('move'),
          format: 'txt',
          enabled: true,
        },
        {
          id: 12,
          name: 'root.txt',
          parent: 0,
          bytes: 4,
          type: 'text/plain',
          data: new TextEncoder().encode('root'),
          format: 'txt',
          enabled: true,
        },
      ],
    };
    const state = createAppState();
    const dbState = createDbState();
    const session = {
      fileName: 'fixture.sqlite',
      data: db,
      copyResourceItems(roots, parentId) {
        const source = roots[0];
        if (!source || source.kind !== 'file') throw new Error('Expected a copied file.');
        const file = {
          id: Math.max(...db.files.map((candidate) => candidate.id)) + 1,
          name: source.name,
          parent: parentId,
          bytes: source.bytes,
          type: source.type,
          data: new Uint8Array(source.data),
          format: source.format,
          enabled: source.enabled,
        };
        db.files.push(file);
        return {
          operation: 'copy',
          roots: [{ kind: 'file', id: file.id }],
          files: [{ file, oldPath: source.path, newPath: `/pool/${file.name}` }],
        };
      },
      moveResourceItems() {
        throw new Error('Unexpected cut operation.');
      },
      moveResourceFile(fileId, parentId) {
        const file = db.files.find((candidate) => candidate.id === fileId);
        if (!file) throw new Error('Missing moved file.');
        file.parent = parentId;
        return file;
      },
      upsertResourceFile(input) {
        const file = {
          id: Math.max(...db.files.map((candidate) => candidate.id)) + 1,
          enabled: true,
          ...input,
        };
        db.files.push(file);
        return file;
      },
    };
    const sessionRef = { current: session };
    const connection = {
      isConnected: () => false,
      subscribeAssets: () => () => {},
    };
    const clipboard = createAssetClipboard();
    const resources = createResourcesPanel(
      state,
      dbState,
      sessionRef,
      connection,
      clipboard,
    );
    resources.init({});

    const editorElement = document.createElement('div');
    editorElement.style.height = '200px';
    root.replaceChildren(resources.element, editorElement);
    state.setActivePanel('resources');
    dbState.setOpen('fixture.sqlite');
    window.__poolClipboardFixture = { db, clipboard, state };
    window.__poolClipboardEditor = monaco.editor.create(editorElement, { value: '' });
    installPoolPathDrop(window.__poolClipboardEditor, editorElement);
  });

  await page.locator('[data-resource-kind="folder"] .resources__label', { hasText: 'shaders' }).click();
  await page.locator('[data-resource-kind="file"] .resources__label', { hasText: 'scene.glsl' }).click();
  await page.keyboard.press('Control+C');
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  await page.locator('.monaco-editor').click();
  await page.keyboard.press('Control+V');
  const editorText = await page.evaluate(() => window.__poolClipboardEditor.getValue());

  if (clipboardText !== '/pool/shaders/scene.glsl' || editorText !== clipboardText) {
    throw new Error(`Pool clipboard paste failed: ${JSON.stringify({ clipboardText, editorText })}`);
  }

  await page.evaluate(() => window.__poolClipboardEditor.setValue(''));
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const sourceFile = page.locator('[data-resource-kind="file"]', { hasText: 'scene.glsl' });
  const editorTarget = page.locator('.monaco-editor .view-lines');
  const editorBox = await editorTarget.boundingBox();
  if (!editorBox) throw new Error('The Monaco drop target is not visible.');
  const dropPoint = { clientX: editorBox.x + 20, clientY: editorBox.y + 20 };
  await sourceFile.dispatchEvent('dragstart', { dataTransfer });
  await editorTarget.dispatchEvent('dragover', { dataTransfer, ...dropPoint });
  await editorTarget.dispatchEvent('drop', { dataTransfer, ...dropPoint });
  await sourceFile.dispatchEvent('dragend', { dataTransfer });
  const droppedEditorText = await page.evaluate(() => window.__poolClipboardEditor.getValue());
  if (droppedEditorText !== '/pool/shaders/scene.glsl') {
    throw new Error(`Pool drag into Monaco failed: ${JSON.stringify({ droppedEditorText })}`);
  }

  const poolRoot = page.locator('.resources__root-row');
  await poolRoot.click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cacablu:asset-clipboard-command', {
    detail: { command: 'paste' },
  })));
  await page.waitForFunction(() => document.querySelector('[data-resource-kind="file"][data-pool-path="pool/scene.glsl"]'));

  const moveFile = page.locator('[data-resource-kind="file"]', { hasText: 'move.txt' });
  const moveTransfer = await page.evaluateHandle(() => new DataTransfer());
  await moveFile.dispatchEvent('dragstart', { dataTransfer: moveTransfer });
  await poolRoot.dispatchEvent('dragover', { dataTransfer: moveTransfer });
  await poolRoot.dispatchEvent('drop', { dataTransfer: moveTransfer });
  await moveFile.dispatchEvent('dragend', { dataTransfer: moveTransfer });

  const externalTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([1, 2, 3])], 'external.bin', { type: 'application/octet-stream' }));
    return transfer;
  });
  await poolRoot.dispatchEvent('dragover', { dataTransfer: externalTransfer });
  await poolRoot.dispatchEvent('drop', { dataTransfer: externalTransfer });

  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('[data-resource-kind="file"]')].map((node) => node.textContent);
    return labels.some((label) => label?.includes('external.bin'));
  });
  const rootResult = await page.evaluate(() => {
    const resources = [...document.querySelectorAll('[data-resource-kind="file"]')];
    return resources.map((element) => ({
      name: element.dataset.resourceName,
      path: element.dataset.poolPath,
    }));
  });
  const rootPaths = rootResult.filter((entry) => ['scene.glsl', 'move.txt', 'external.bin'].includes(entry.name));
  if (!rootPaths.some((entry) => entry.path === 'pool/scene.glsl')
    || !rootPaths.some((entry) => entry.path === 'pool/move.txt')
    || !rootPaths.some((entry) => entry.path === 'pool/external.bin')) {
    throw new Error(`Pool root destinations failed: ${JSON.stringify(rootPaths)}`);
  }

  const rootSource = page.locator('[data-resource-kind="file"][data-pool-path="pool/root.txt"]');
  await rootSource.click();
  const menuCopyAccepted = await page.evaluate(() => document.execCommand('copy'));
  const rootSnapshot = await page.evaluate(() => {
    const root = window.__poolClipboardFixture.clipboard.getSnapshot()?.roots[0];
    return root ? { kind: root.kind, name: root.name, path: root.path } : null;
  });
  await page.locator('.resources__folder-row', { hasText: 'shaders' }).click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cacablu:asset-clipboard-command', {
    detail: { command: 'paste' },
  })));
  await page.waitForFunction(
    () => window.__poolClipboardFixture.db.files.some((file) => file.name === 'root.txt' && file.parent === 1),
    null,
    { timeout: 1000 },
  ).catch(async () => {
    const diagnostic = await page.evaluate(() => ({
      snapshot: window.__poolClipboardFixture.clipboard.getSnapshot(),
      selection: window.__poolClipboardFixture.state.getSnapshot().assetSelection,
      files: window.__poolClipboardFixture.db.files.map((file) => ({ id: file.id, name: file.name, parent: file.parent })),
      folders: window.__poolClipboardFixture.db.folders,
      events: window.__poolClipboardFixture.state.getSnapshot().events,
    }));
    throw new Error(`Root file paste did not complete: ${JSON.stringify(diagnostic)}`);
  });
  const selfNestedFolder = await page.locator('[data-resource-kind="folder"][data-pool-path="pool/shaders/shaders"]').count();
  if (rootSnapshot?.kind !== 'file' || rootSnapshot.name !== 'root.txt' || selfNestedFolder !== 0) {
    throw new Error(`Root file copied as the wrong item: ${JSON.stringify({ rootSnapshot, selfNestedFolder })}`);
  }

  const destinationFolder = page.locator('.resources__folder-row', { hasText: 'shaders' });
  await destinationFolder.click();
  await page.evaluate(() => document.execCommand('copy'));
  await destinationFolder.click();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('cacablu:asset-clipboard-command', {
    detail: { command: 'paste' },
  })));
  const rejectedSelfCopy = await page.evaluate(() => ({
    nestedFolder: window.__poolClipboardFixture.db.folders.some((folder) => folder.name === 'shaders' && folder.parent === 1),
    error: window.__poolClipboardFixture.state.getSnapshot().events.at(-1)?.description,
  }));
  if (rejectedSelfCopy.nestedFolder || !rejectedSelfCopy.error?.includes('cannot be copied into itself')) {
    throw new Error(`Pool folder self-copy was not rejected: ${JSON.stringify(rejectedSelfCopy)}`);
  }
  console.log(JSON.stringify({
    clipboardText,
    editorText,
    droppedEditorText,
    rootPaths,
    rootSnapshot,
    menuCopyAccepted,
    rejectedSelfCopy,
  }, null, 2));
} finally {
  await browser.close();
}
