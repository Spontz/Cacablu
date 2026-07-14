/* global process, console, window, document, TextEncoder, TextDecoder */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [
      { createGlslAssetEditorPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
    ] = await Promise.all([
      import('/src/panels/glsl-asset-editor-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const encoder = new TextEncoder();
    const initialContent = 'void main() {}';
    const file = {
      id: 7,
      name: 'effect.glsl',
      parent: 0,
      bytes: encoder.encode(initialContent).byteLength,
      type: 'text/plain',
      data: encoder.encode(initialContent),
      format: 'glsl',
      enabled: true,
    };
    const session = {
      fileName: 'fixture.sqlite',
      data: {
        variables: new Map(),
        bars: [],
        fbos: [],
        files: [file],
        folders: [],
        markers: [],
      },
      updateResourceFileContent(fileId, input) {
        if (fileId !== file.id) throw new Error(`Unexpected file ${fileId}`);
        Object.assign(file, input);
        return file;
      },
    };
    const state = createAppState();
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const sessionRef = { current: session };
    const connection = { isConnected: () => false };

    state.setAssetSelection({ kind: 'file', id: file.id });
    dbState.setOpen(session.fileName);
    const panel = createGlslAssetEditorPanel(state, dbState, sessionRef, connection, undoManager);
    document.body.replaceChildren(panel.element);
    panel.element.style.height = '100vh';
    panel.init({});

    window.__glslUndoFixture = {
      initialContent,
      readDatabase: () => new TextDecoder().decode(file.data),
      readEditor: () => (document.querySelector('.monaco-editor .view-lines')?.textContent ?? '').replaceAll('\u00a0', ' '),
      canUndo: () => undoManager.canUndo(),
      undo: () => undoManager.undo(),
      dispose: () => panel.dispose(),
    };
  });

  const editor = page.locator('.monaco-editor');
  await editor.waitFor({ state: 'visible' });
  await page.locator('.monaco-editor .view-lines').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Control+Home');
  await page.keyboard.insertText('// changed');

  const editedContent = await page.evaluate(() => window.__glslUndoFixture.readEditor());
  if (!editedContent.startsWith('// changed')) throw new Error(`Could not edit the GLSL fixture: ${JSON.stringify(editedContent)}`);

  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.waitForFunction(() => window.__glslUndoFixture.readDatabase().startsWith('// changed'));
  const afterSave = await page.evaluate(() => ({
    editor: window.__glslUndoFixture.readEditor(),
    database: window.__glslUndoFixture.readDatabase(),
    canUndo: window.__glslUndoFixture.canUndo(),
  }));

  await page.locator('.monaco-editor .view-lines').click({ position: { x: 8, y: 8 } });
  const focusedElement = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    className: document.activeElement?.className,
    role: document.activeElement?.getAttribute('role'),
  }));
  await page.locator('.monaco-editor textarea').press('Control+Z');
  await page.waitForTimeout(100);
  await page.locator('.monaco-editor textarea').press('Control+Z');
  const afterTextUndo = await page.evaluate(() => ({
    editor: window.__glslUndoFixture.readEditor(),
    database: window.__glslUndoFixture.readDatabase(),
    canUndo: window.__glslUndoFixture.canUndo(),
  }));

  await page.evaluate(() => window.__glslUndoFixture.undo());
  await page.waitForFunction(() => window.__glslUndoFixture.readDatabase() === window.__glslUndoFixture.initialContent);
  await page.waitForFunction(() => window.__glslUndoFixture.readEditor() === window.__glslUndoFixture.initialContent);
  const afterSavedUndo = await page.evaluate(() => ({
    editor: window.__glslUndoFixture.readEditor(),
    database: window.__glslUndoFixture.readDatabase(),
    canUndo: window.__glslUndoFixture.canUndo(),
  }));

  if (
    !afterSave.editor.startsWith('// changed')
    || !afterSave.database.startsWith('// changed')
    || !afterSave.canUndo
    || afterTextUndo.editor !== afterSavedUndo.editor
    || afterTextUndo.editor !== 'void main() {}'
    || !afterTextUndo.database.startsWith('// changed')
    || !afterTextUndo.canUndo
    || afterSavedUndo.database !== 'void main() {}'
    || afterSavedUndo.canUndo
  ) {
    throw new Error(`GLSL undo workflow failed: ${JSON.stringify({ focusedElement, afterSave, afterTextUndo, afterSavedUndo })}`);
  }

  console.log(JSON.stringify({ afterSave, afterTextUndo, afterSavedUndo }, null, 2));
} finally {
  await browser.close();
}
