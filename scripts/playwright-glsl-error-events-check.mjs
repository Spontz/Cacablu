/* global process, console, window, document, TextEncoder */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
let logRequestCount = 0;
let previewRequest = null;
let previewRequestCount = 0;

await page.route('http://127.0.0.1:29100/api/logs/recent', async (route) => {
  logRequestCount += 1;
  const earlier = { sequence: 91001, severity: 'error', message: 'Earlier unrelated Phoenix error' };
  const failureEntries = [
        earlier,
        { sequence: 91002, severity: 'error', message: 'Shader Compile (Fragment - pool/effect.glsl) log: syntax error A' },
        { sequence: 91003, severity: 'error', message: 'Section efxBloom [id: 17, DataSource: Network] not loaded properly!' },
        { sequence: 91004, severity: 'error', message: 'Shader Linking: file pool/effect.glsl, log: link error B' },
        { sequence: 91005, severity: 'error', message: 'Section efxBlur [id: 23, DataSource: Network] not loaded properly!' },
      ];
  const entries = logRequestCount === 1
    ? [earlier]
    : logRequestCount < 4
      ? failureEntries
      : [
          ...failureEntries,
          { sequence: 91006, severity: 'info', message: 'Section 0 [id: 17, DataSource: Network] loaded OK!' },
          { sequence: 91007, severity: 'info', message: 'Section 1 [id: 23, DataSource: Network] loaded OK!' },
        ];
  await route.fulfill({ json: { entries } });
});

await page.route('http://127.0.0.1:29100/api/assets/preview', async (route) => {
  previewRequestCount += 1;
  previewRequest = route.request().postDataJSON();
  const repaired = previewRequestCount === 2;
  await route.fulfill({
    json: {
      requestId: previewRequest.requestId,
      ok: true,
      operation: 'preview-asset',
      path: 'pool/effect.glsl',
      persisted: false,
      entry: { path: 'pool/effect.glsl', kind: 'file', size: previewRequest.content.length, hash: 'fixture' },
      reloadedSections: repaired
        ? [
            { id: '17', type: 'efxBloom', message: 'Reloaded after asset change.' },
            { id: '23', type: 'efxBlur', message: 'Reloaded after asset change.' },
          ]
        : [],
      deactivatedSections: [],
      failedSections: repaired
        ? []
        : [
            { id: '17', type: 'efxBloom', message: 'Could not reload section after asset change.' },
            { id: '23', type: 'efxBlur', message: 'Could not reload section after asset change.' },
          ],
    },
  });
});

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
    const sessionRef = { current: session };
    const connection = { isConnected: () => true };
    const panel = createGlslAssetEditorPanel(
      state,
      dbState,
      sessionRef,
      connection,
      createUndoManager(),
    );

    state.setActivePanel('glsl-editor');
    state.setAssetSelection({ kind: 'file', id: file.id });
    dbState.setOpen(session.fileName);
    document.body.replaceChildren(panel.element);
    panel.element.style.height = '100vh';
    panel.init({ params: { fileId: file.id } });

    window.__glslErrorFixture = {
      snapshot: () => state.getSnapshot(),
      readEditor: () => (document.querySelector('.monaco-editor .view-lines')?.textContent ?? '').replaceAll('\u00a0', ' '),
      dispose: () => panel.dispose(),
    };
  });

  const editor = page.locator('.monaco-editor');
  await editor.waitFor({ state: 'visible' });
  await page.locator('.monaco-editor .view-lines').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('\nBROKEN_SHADER');
  const textBeforePreview = await page.evaluate(() => window.__glslErrorFixture.readEditor());

  await page.getByRole('button', { name: 'Actualizar' }).click();
  await page.waitForFunction(() => window.__glslErrorFixture.snapshot().events.length >= 6);

  const stateAfterPreview = await page.evaluate(() => {
    const snapshot = window.__glslErrorFixture.snapshot();
    return {
      activePanelId: snapshot.activePanelId,
      sectionErrorIds: snapshot.sectionErrorIds,
      hasUnreadErrors: snapshot.hasUnreadErrors,
      events: snapshot.events.map(({ severity, source, subjectId, description }) => ({ severity, source, subjectId, description })),
      editorText: window.__glslErrorFixture.readEditor(),
    };
  });

  const descriptions = stateAfterPreview.events.map((event) => event.description);
  if (
    logRequestCount !== 2
    || previewRequest?.path !== 'pool/effect.glsl'
    || !previewRequest?.content.includes('BROKEN_SHADER')
    || stateAfterPreview.activePanelId !== 'glsl-editor'
    || JSON.stringify(stateAfterPreview.sectionErrorIds) !== JSON.stringify([17, 23])
    || !stateAfterPreview.hasUnreadErrors
    || descriptions.some((description) => description.includes('Earlier unrelated Phoenix error'))
    || !descriptions.some((description) => description.includes('syntax error A'))
    || !descriptions.some((description) => description.includes('link error B'))
    || stateAfterPreview.editorText !== textBeforePreview
  ) {
    throw new Error(`GLSL error notification workflow failed: ${JSON.stringify({ logRequestCount, previewRequest, stateAfterPreview })}`);
  }

  await page.locator('.monaco-editor .view-lines').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('void main() {}');
  const repairedText = await page.evaluate(() => window.__glslErrorFixture.readEditor());
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await page.waitForFunction(() => window.__glslErrorFixture.snapshot().sectionErrorIds.length === 0);

  const stateAfterRepair = await page.evaluate(() => {
    const snapshot = window.__glslErrorFixture.snapshot();
    return {
      activePanelId: snapshot.activePanelId,
      sectionErrorIds: snapshot.sectionErrorIds,
      hasUnreadErrors: snapshot.hasUnreadErrors,
      events: snapshot.events.map(({ severity, source, subjectId, description }) => ({ severity, source, subjectId, description })),
      editorText: window.__glslErrorFixture.readEditor(),
    };
  });
  const unresolvedEvents = stateAfterRepair.events.filter((event) => (
    (event.subjectId === '17' || event.subjectId === '23')
    && event.severity === 'error'
    && (event.source === 'Phoenix asset impact' || event.source === 'Phoenix log')
  ));
  if (
    logRequestCount !== 4
    || previewRequestCount !== 2
    || previewRequest?.content !== 'void main() {}'
    || stateAfterRepair.activePanelId !== 'glsl-editor'
    || stateAfterRepair.sectionErrorIds.length !== 0
    || stateAfterRepair.hasUnreadErrors
    || unresolvedEvents.length !== 0
    || stateAfterRepair.editorText !== repairedText
  ) {
    throw new Error(`GLSL repair workflow failed: ${JSON.stringify({ logRequestCount, previewRequestCount, previewRequest, stateAfterRepair })}`);
  }

  console.log(JSON.stringify({
    logRequestCount,
    failedSections: stateAfterPreview.sectionErrorIds,
    recoveredSections: stateAfterRepair.sectionErrorIds,
    remainingEventCount: stateAfterRepair.events.length,
    activePanelId: stateAfterRepair.activePanelId,
  }, null, 2));
} finally {
  await browser.close();
}
