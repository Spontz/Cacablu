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
      files: [{
        id: 10,
        name: 'scene.glsl',
        parent: 1,
        bytes: 13,
        type: 'text/plain',
        data: new TextEncoder().encode('void main(){}'),
        format: 'glsl',
        enabled: true,
      }],
    };
    const state = createAppState();
    const dbState = createDbState();
    const sessionRef = { current: { fileName: 'fixture.sqlite', data: db } };
    const connection = {
      isConnected: () => false,
      subscribeAssets: () => () => {},
    };
    const resources = createResourcesPanel(
      state,
      dbState,
      sessionRef,
      connection,
      createAssetClipboard(),
    );
    resources.init({});

    const editorElement = document.createElement('div');
    editorElement.style.height = '200px';
    root.replaceChildren(resources.element, editorElement);
    state.setActivePanel('resources');
    dbState.setOpen('fixture.sqlite');
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
  console.log(JSON.stringify({ clipboardText, editorText, droppedEditorText }, null, 2));
} finally {
  await browser.close();
}
