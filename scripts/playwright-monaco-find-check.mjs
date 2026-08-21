/* global process, console, window, document, TextEncoder, HTMLButtonElement, KeyboardEvent, CustomEvent */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const rawTemplateRequests = [];

function panel(selector) {
  return page.locator(`[data-test-editor="${selector}"]`);
}

async function selectFirstRepeat(selector) {
  const editor = panel(selector).locator('.monaco-editor .view-lines');
  await editor.click({ position: { x: 12, y: 10 } });
  await page.keyboard.press('Control+Home');
  await page.keyboard.down('Shift');
  for (let index = 0; index < 'repeat'.length; index += 1) {
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.up('Shift');
}

async function openFind(selector) {
  await selectFirstRepeat(selector);
  await page.keyboard.press('Control+f');

  const widget = panel(selector).locator('.find-widget');
  await widget.waitFor({ state: 'visible' });
  const input = widget.locator('.find-part .input').first();
  await input.waitFor({ state: 'visible' });
  return { widget, input };
}

async function readEditorState(selector) {
  return panel(selector).evaluate((element) => ({
    text: element.querySelector('.monaco-editor .view-lines')?.textContent?.replaceAll('\u00a0', ' ') ?? '',
    saveDisabled: element.querySelector('.glsl-editor__button--primary')?.disabled ?? null,
  }));
}

async function readMatchCount(widget) {
  return (await widget.locator('.matchesCount').textContent())?.trim() ?? '';
}

try {
  await page.route('https://api.github.com/repos/Spontz/Dungeon/**', (route) => route.fulfill({
    status: 403,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'API rate limit exceeded' }),
  }));
  await page.route('https://raw.githubusercontent.com/Spontz/Dungeon/master/Engines/Phoenix/CodeTemplates/**', (route) => {
    rawTemplateRequests.push(route.request().url());
    if (route.request().url().endsWith('/drawQuad/drawQuad.template')) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: 'direct template loaded' });
    }
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [
      { createSectionEditorPanel },
      { createGlslAssetEditorPanel },
      { createCamAssetEditorPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
    ] = await Promise.all([
      import('/src/panels/section-editor-panel.ts'),
      import('/src/panels/glsl-asset-editor-panel.ts'),
      import('/src/panels/cam-asset-editor-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const encoder = new TextEncoder();
    const sourceText = 'repeat Repeat repeat repeater Ω.repeat';
    const glslBytes = encoder.encode(sourceText);
    const camBytes = encoder.encode(sourceText);
    const glslFile = {
      id: 7,
      name: 'find.glsl',
      parent: 0,
      bytes: glslBytes.byteLength,
      type: 'text/plain',
      data: glslBytes,
      format: 'glsl',
      enabled: true,
    };
    const camFile = {
      id: 8,
      name: 'find.cam',
      parent: 0,
      bytes: camBytes.byteLength,
      type: 'text/plain',
      data: camBytes,
      format: 'cam',
      enabled: true,
    };
    const bar = {
      id: 3,
      name: 'Find section',
      layer: 0,
      startTime: 0,
      endTime: 1,
      enabled: true,
      type: '',
      script: sourceText,
      content: '',
      srcBlending: 'ONE',
      dstBlending: 'ZERO',
      blendingEQ: 'ADD',
    };
    const session = {
      fileName: 'find-fixture.sqlite',
      data: {
        variables: new Map(),
        bars: [bar],
        fbos: [],
        files: [glslFile, camFile],
        folders: [],
        markers: [],
      },
      updateResourceFileContent(fileId, input) {
        const file = this.data.files.find((candidate) => candidate.id === fileId);
        if (!file) throw new Error(`Unexpected file ${fileId}`);
        Object.assign(file, input);
        return file;
      },
      updateCell(table, rowId, column, value) {
        if (table !== 'bars' || rowId !== bar.id) throw new Error(`Unexpected cell ${table}.${rowId}.${column}`);
        bar[column] = value;
      },
    };
    const state = createAppState();
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const sessionRef = { current: session };
    const connection = { isConnected: () => false };

    state.setResourceSelection({ kind: 'bar', id: bar.id });
    dbState.setOpen(session.fileName);

    const root = document.createElement('main');
    root.style.display = 'grid';
    root.style.gridTemplateRows = 'repeat(3, minmax(0, 1fr))';
    root.style.height = '100vh';

    const section = createSectionEditorPanel(state, dbState, sessionRef, connection, undoManager);
    const glsl = createGlslAssetEditorPanel(state, dbState, sessionRef, connection, undoManager);
    const cam = createCamAssetEditorPanel(state, dbState, sessionRef, connection, undoManager);
    section.element.dataset.testEditor = 'section';
    glsl.element.dataset.testEditor = 'glsl';
    cam.element.dataset.testEditor = 'cam';
    root.append(section.element, glsl.element, cam.element);
    document.body.replaceChildren(root);
    section.init({});
    glsl.init({ params: { fileId: glslFile.id } });
    cam.init({ params: { fileId: camFile.id } });

    window.__monacoFindFixture = {
      state: () => ({
        canUndo: undoManager.canUndo(),
        isDirty: dbState.getSnapshot().isDirty,
        bar: {
          name: bar.name,
          type: bar.type,
          script: bar.script,
          startTime: bar.startTime,
        },
      }),
      dispose: () => {
        section.dispose();
        glsl.dispose();
        cam.dispose();
      },
    };
  });

  for (const selector of ['section', 'glsl', 'cam']) {
    await panel(selector).locator('.monaco-editor').waitFor({ state: 'visible' });
  }

  const initial = Object.fromEntries(await Promise.all(
    ['section', 'glsl', 'cam'].map(async (selector) => [selector, await readEditorState(selector)]),
  ));

  const results = {};
  for (const selector of ['section', 'glsl', 'cam']) {
    const { widget, input } = await openFind(selector);
    const seededQuery = await input.inputValue();
    const matchCount = await readMatchCount(widget);
    const toggleCount = await widget.locator('.monaco-custom-toggle').count();
    const widgetCount = await panel(selector).locator('.find-widget').count();

    await page.keyboard.press('Control+f');
    const repeatedWidgetCount = await panel(selector).locator('.find-widget').count();

    await page.keyboard.press('Enter');
    const afterNext = await readMatchCount(widget);
    await widget.getByRole('button', { name: /Previous Match/ }).click();
    const afterPrevious = await readMatchCount(widget);
    await widget.getByRole('button', { name: /Previous Match/ }).click();
    const afterWrapPrevious = await readMatchCount(widget);

    if (selector === 'cam' && process.env.CACABLU_E2E_SCREENSHOT) {
      await page.screenshot({ path: process.env.CACABLU_E2E_SCREENSHOT, fullPage: true });
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction((panelSelector) => (
      document.querySelector(`[data-test-editor="${panelSelector}"] .find-widget`)?.getAttribute('aria-hidden') === 'true'
    ), selector);
    const focusReturned = await panel(selector).evaluate((element) => (
      element.contains(document.activeElement)
      && !document.activeElement?.closest('.find-widget')
    ));

    results[selector] = {
      seededQuery,
      matchCount,
      toggleCount,
      widgetCount,
      repeatedWidgetCount,
      afterNext,
      afterPrevious,
      afterWrapPrevious,
      focusReturned,
    };
  }

  const { widget: glslWidget, input: glslInput } = await openFind('glsl');
  await glslWidget.locator('[aria-label^="Match Case"]').click();
  await page.waitForTimeout(250);
  const caseSensitiveCount = await readMatchCount(glslWidget);
  await glslWidget.locator('[aria-label^="Match Whole Word"]').click();
  await page.waitForTimeout(250);
  const wholeWordCount = await readMatchCount(glslWidget);
  await glslWidget.locator('[aria-label^="Match Whole Word"]').click();
  await glslWidget.locator('[aria-label^="Use Regular Expression"]').click();
  await glslInput.fill('r.pe.t');
  await page.waitForTimeout(250);
  const regexCount = await readMatchCount(glslWidget);
  await glslInput.fill('does-not-exist');
  await page.waitForFunction(() => (
    document.querySelector('[data-test-editor="glsl"] .find-widget .matchesCount')?.textContent?.trim() === 'No results'
  ));
  const noResults = await readMatchCount(glslWidget);
  await page.keyboard.press('Escape');

  const shortcutScope = await page.evaluate(async () => {
    const button = document.querySelector('[data-test-editor="glsl"] .glsl-editor__button--primary');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing outside-editor button');
    button.disabled = false;
    button.focus();
    let prevented = null;
    const listener = (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'f') prevented = event.defaultPrevented;
    };
    window.addEventListener('keydown', listener);
    button.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f',
      code: 'KeyF',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }));
    window.removeEventListener('keydown', listener);
    button.disabled = true;
    return prevented;
  });

  const final = Object.fromEntries(await Promise.all(
    ['section', 'glsl', 'cam'].map(async (selector) => [selector, await readEditorState(selector)]),
  ));
  const applicationState = await page.evaluate(() => window.__monacoFindFixture.state());

  for (const [selector, result] of Object.entries(results)) {
    if (
      result.seededQuery !== 'repeat'
      || !result.matchCount.includes('1 of 5')
      || result.toggleCount < 3
      || result.widgetCount !== 1
      || result.repeatedWidgetCount !== 1
      || !result.afterNext.includes('2 of 5')
      || !result.afterPrevious.includes('1 of 5')
      || !result.afterWrapPrevious.includes('5 of 5')
      || !result.focusReturned
    ) {
      throw new Error(`Find workflow failed for ${selector}: ${JSON.stringify(result)}`);
    }
  }

  if (
    noResults !== 'No results'
    || !caseSensitiveCount.endsWith('of 4')
    || !wholeWordCount.endsWith('of 3')
    || !regexCount.endsWith('of 4')
    || shortcutScope !== false
    || JSON.stringify(final) !== JSON.stringify(initial)
    || applicationState.canUndo
    || applicationState.isDirty
  ) {
    throw new Error(`Find state preservation failed: ${JSON.stringify({
      noResults,
      caseSensitiveCount,
      wholeWordCount,
      regexCount,
      shortcutScope,
      initial,
      final,
      applicationState,
    })}`);
  }

  await page.evaluate(() => {
    window.__monacoFindFixture.editorNodes = Object.fromEntries(
      ['section', 'glsl', 'cam'].map((selector) => [
        selector,
        document.querySelector(`[data-test-editor="${selector}"] .monaco-editor`),
      ]),
    );
  });

  const dragPreviewBehavior = await page.evaluate(() => {
    const section = document.querySelector('[data-test-editor="section"]');
    const editorBefore = section?.querySelector('.monaco-editor');
    window.dispatchEvent(new CustomEvent('cacablu:timeline-bar-placement-preview', {
      detail: { bars: [{ id: 3, startTime: 2.25, endTime: 4.75 }] },
    }));
    const result = {
      startTime: section?.querySelector('[data-bar-time-field="start"]')?.value ?? null,
      endTime: section?.querySelector('[data-bar-time-field="end"]')?.value ?? null,
      editorPreserved: editorBefore === section?.querySelector('.monaco-editor'),
    };
    window.dispatchEvent(new CustomEvent('cacablu:timeline-bar-placement-preview', {
      detail: { bars: [{ id: 3, startTime: 0, endTime: 1 }] },
    }));
    return result;
  });
  if (
    dragPreviewBehavior.startTime !== '2.25'
    || dragPreviewBehavior.endTime !== '4.75'
    || !dragPreviewBehavior.editorPreserved
  ) {
    throw new Error(`Timeline drag did not update the Bar Editor safely: ${JSON.stringify(dragPreviewBehavior)}`);
  }

  for (const [selector, content] of [['glsl', 'unsaved GLSL draft'], ['cam', 'unsaved CAM draft']]) {
    await panel(selector).locator('.monaco-editor .view-lines').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText(content);
  }
  await panel('section').locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('saved section script');
  await panel('section').locator('.section-editor__button--primary').click();

  const savePreservation = await page.evaluate(() => {
    const fixture = window.__monacoFindFixture;
    const editorTexts = Object.fromEntries(
      ['section', 'glsl', 'cam'].map((selector) => [
        selector,
        document.querySelector(`[data-test-editor="${selector}"] .monaco-editor .view-lines`)
          ?.textContent?.replaceAll('\u00a0', ' ') ?? '',
      ]),
    );
    return {
      sameNodes: Object.fromEntries(
        ['section', 'glsl', 'cam'].map((selector) => [
          selector,
          fixture.editorNodes[selector]
            === document.querySelector(`[data-test-editor="${selector}"] .monaco-editor`),
        ]),
      ),
      editorTexts,
      state: fixture.state(),
    };
  });

  if (
    Object.values(savePreservation.sameNodes).some((same) => !same)
    || !savePreservation.editorTexts.section.includes('saved section script')
    || !savePreservation.editorTexts.glsl.includes('unsaved GLSL draft')
    || !savePreservation.editorTexts.cam.includes('unsaved CAM draft')
    || !savePreservation.state.canUndo
    || !savePreservation.state.isDirty
  ) {
    throw new Error(`Saving a section reloaded a text editor: ${JSON.stringify(savePreservation)}`);
  }

  const sectionPanel = panel('section');
  const nameInput = sectionPanel.locator('.section-editor__field').filter({ hasText: 'Name' }).locator('input');
  await nameInput.fill('Applied with Enter');
  await nameInput.press('Enter');
  await page.waitForFunction(() => window.__monacoFindFixture.state().bar.name === 'Applied with Enter');

  const barTypeInput = sectionPanel.locator('.section-editor__field').filter({ hasText: 'Bar Type' }).locator('input');
  await barTypeInput.fill('drawQuad');
  await barTypeInput.press('Enter');
  await page.waitForFunction(() => window.__monacoFindFixture.state().bar.type === 'drawQuad');

  const startInput = sectionPanel.locator('.section-editor__field').filter({ hasText: 'Start Time' }).locator('input');
  await startInput.fill('0.25');
  await startInput.press('Enter');
  await page.waitForFunction(() => window.__monacoFindFixture.state().bar.startTime === 0.25);

  await sectionPanel.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('editor newline remains unsaved');
  const enterApplyBehavior = {
    state: await page.evaluate(() => window.__monacoFindFixture.state()),
    editorText: await readEditorState('section'),
  };

  if (
    enterApplyBehavior.state.bar.name !== 'Applied with Enter'
    || enterApplyBehavior.state.bar.type !== 'drawQuad'
    || enterApplyBehavior.state.bar.startTime !== 0.25
    || enterApplyBehavior.state.bar.script !== 'saved section script'
    || !enterApplyBehavior.editorText.text.includes('editor newline remains unsaved')
  ) {
    throw new Error(`Section Enter behavior failed: ${JSON.stringify(enterApplyBehavior)}`);
  }

  const scriptTemplateField = sectionPanel.locator('.section-editor__field').filter({ hasText: 'Script Template' });
  const scriptTemplateInput = scriptTemplateField.locator('input');
  await scriptTemplateInput.click();
  await scriptTemplateField.locator('.section-editor__combo-option', { hasText: /^drawQuad$/ }).click();
  await page.waitForTimeout(500);
  const directTemplateBehavior = {
    selectedTemplate: await scriptTemplateInput.inputValue(),
    editorText: await readEditorState('section'),
    rawTemplateRequests,
  };
  if (
    directTemplateBehavior.selectedTemplate !== 'drawQuad'
    || !directTemplateBehavior.editorText.text.includes('direct template loaded')
  ) {
    throw new Error(`Direct script template route failed: ${JSON.stringify(directTemplateBehavior)}`);
  }

  console.log(JSON.stringify({
    results,
    modes: { caseSensitiveCount, wholeWordCount, regexCount },
    noResults,
    shortcutScope,
    applicationState,
    dragPreviewBehavior,
    savePreservation,
    enterApplyBehavior,
    directTemplateBehavior,
  }, null, 2));
} finally {
  await browser.close();
}
