/* global process, console, window, document, TextEncoder */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function selectFirstRepeat(panelSelector) {
  const lines = page.locator(`${panelSelector} .monaco-editor .view-lines`);
  await lines.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Control+Home');
  await page.keyboard.down('Shift');
  for (let index = 0; index < 'repeat'.length; index += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.up('Shift');
}

async function readPanel(panelSelector) {
  return page.locator(panelSelector).evaluate((panel) => ({
    text: panel.querySelector('.monaco-editor .view-lines')?.textContent?.replaceAll('\u00a0', ' ') ?? '',
    matches: panel.querySelectorAll('.cacablu-code-selection-occurrence').length,
    cursors: panel.querySelectorAll('.cursor').length,
  }));
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [
      { createSectionEditorPanel },
      { createGlslAssetEditorPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
    ] = await Promise.all([
      import('/src/panels/section-editor-panel.ts'),
      import('/src/panels/glsl-asset-editor-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const encoder = new TextEncoder();
    const shaderText = 'repeat repeat repeat';
    const file = {
      id: 7,
      name: 'repeat.glsl',
      parent: 0,
      bytes: encoder.encode(shaderText).byteLength,
      type: 'text/plain',
      data: encoder.encode(shaderText),
      format: 'glsl',
      enabled: true,
    };
    const bar = {
      id: 3,
      name: 'Repeated section',
      layer: 0,
      startTime: 0,
      endTime: 1,
      enabled: true,
      type: '',
      script: shaderText,
      content: '',
      srcBlending: 'ONE',
      dstBlending: 'ZERO',
      blendingEQ: 'ADD',
    };
    const session = {
      fileName: 'fixture.sqlite',
      data: {
        variables: new Map(),
        bars: [bar],
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

    state.setResourceSelection({ kind: 'bar', id: bar.id });
    state.setAssetSelection({ kind: 'file', id: file.id });
    dbState.setOpen(session.fileName);

    const root = document.createElement('main');
    root.style.display = 'grid';
    root.style.gridTemplateRows = '1fr 1fr';
    root.style.height = '100vh';
    const section = createSectionEditorPanel(state, dbState, sessionRef, connection, undoManager);
    const glsl = createGlslAssetEditorPanel(state, dbState, sessionRef, connection, undoManager);
    section.element.dataset.testEditor = 'section';
    glsl.element.dataset.testEditor = 'glsl';
    root.append(section.element, glsl.element);
    document.body.replaceChildren(root);
    section.init({});
    glsl.init({ params: { fileId: file.id } });
    window.__selectionOccurrenceFixture = {
      canUndo: () => undoManager.canUndo(),
      dispose: () => {
        section.dispose();
        glsl.dispose();
      },
    };
  });

  const sectionSelector = '[data-test-editor="section"]';
  const glslSelector = '[data-test-editor="glsl"]';
  await page.locator(`${sectionSelector} .monaco-editor`).waitFor({ state: 'visible' });
  await page.locator(`${glslSelector} .monaco-editor`).waitFor({ state: 'visible' });

  const initialSection = await readPanel(sectionSelector);
  const initialGlsl = await readPanel(glslSelector);

  await selectFirstRepeat(sectionSelector);
  await page.waitForFunction((selector) => document.querySelectorAll(`${selector} .cacablu-code-selection-occurrence`).length === 2, sectionSelector);
  const selectedSection = await readPanel(sectionSelector);
  const untouchedGlsl = await readPanel(glslSelector);

  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((selector) => document.querySelectorAll(`${selector} .cacablu-code-selection-occurrence`).length === 0, sectionSelector);
  const clearedSection = await readPanel(sectionSelector);

  await selectFirstRepeat(glslSelector);
  await page.waitForFunction((selector) => document.querySelectorAll(`${selector} .cacablu-code-selection-occurrence`).length === 2, glslSelector);
  const selectedGlsl = await readPanel(glslSelector);
  const finalCanUndo = await page.evaluate(() => window.__selectionOccurrenceFixture.canUndo());

  if (
    initialSection.text !== selectedSection.text
    || initialSection.text !== clearedSection.text
    || initialGlsl.text !== selectedGlsl.text
    || selectedSection.matches !== 2
    || untouchedGlsl.matches !== 0
    || clearedSection.matches !== 0
    || selectedGlsl.matches !== 2
    || selectedSection.cursors !== initialSection.cursors
    || selectedGlsl.cursors !== initialGlsl.cursors
    || finalCanUndo
  ) {
    throw new Error(`Selection occurrence workflow failed: ${JSON.stringify({
      initialSection,
      initialGlsl,
      selectedSection,
      untouchedGlsl,
      clearedSection,
      selectedGlsl,
      finalCanUndo,
    })}`);
  }

  console.log(JSON.stringify({ selectedSection, untouchedGlsl, clearedSection, selectedGlsl, finalCanUndo }, null, 2));
} finally {
  await browser.close();
}
