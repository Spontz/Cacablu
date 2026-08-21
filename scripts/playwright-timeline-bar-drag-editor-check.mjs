/* global process, console, window, document */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30_000);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [
      { createTimelinePanel },
      { createSectionEditorPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
    ] = await Promise.all([
      import('/src/panels/timeline-panel.ts'),
      import('/src/panels/section-editor-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const bar = {
      id: 41,
      name: 'Dragged section',
      layer: 0,
      startTime: 1,
      endTime: 3,
      enabled: true,
      selected: false,
      type: '',
      script: 'test = true',
      content: '',
      srcBlending: 'ONE',
      dstBlending: 'ZERO',
      blendingEQ: 'ADD',
    };
    const secondBar = {
      ...bar,
      id: 42,
      name: 'Second section',
      layer: 2,
      startTime: 6,
      endTime: 8,
    };
    const session = {
      fileName: 'timeline-drag-fixture.sqlite',
      data: {
        variables: new Map([['startTime', '0'], ['endTime', '12']]),
        bars: [bar, secondBar],
        fbos: [],
        files: [],
        folders: [],
        markers: [],
      },
      updateCell(table, rowId, column, value) {
        const targetBar = table === 'bars'
          ? this.data.bars.find((candidate) => candidate.id === rowId)
          : null;
        if (!targetBar) throw new Error(`Unexpected cell ${table}.${rowId}.${column}`);
        targetBar[column] = value;
      },
    };
    const state = createAppState();
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const sessionRef = { current: session };
    const connection = {
      isConnected: () => false,
      send: () => {},
      subscribeRuntime: () => () => {},
    };
    dbState.setOpen(session.fileName);

    const root = document.createElement('main');
    root.style.display = 'grid';
    root.style.gridTemplateRows = '400px minmax(0, 1fr)';
    root.style.height = '100vh';
    const timeline = createTimelinePanel(state, dbState, sessionRef, connection, undoManager);
    const editor = createSectionEditorPanel(state, dbState, sessionRef, connection, undoManager);
    root.append(timeline.element, editor.element);
    document.body.replaceChildren(root);
    timeline.init({});
    editor.init({});

    window.__timelineDragFixture = {
      read: () => ({
        bar: { startTime: bar.startTime, endTime: bar.endTime, layer: bar.layer },
        selection: state.getSnapshot().resourceSelection,
      }),
      dispose: () => {
        timeline.dispose();
        editor.dispose();
      },
    };
  });

  const clip = page.locator('[data-bar-id="41"]');
  await clip.waitFor({ state: 'visible' });
  const clipTextSelection = await clip.evaluate((element) => ({
    clip: window.getComputedStyle(element).userSelect,
    label: window.getComputedStyle(element.querySelector('.timeline-panel__clip-label')).userSelect,
  }));
  if (clipTextSelection.clip !== 'none' || clipTextSelection.label !== 'none') {
    throw new Error(`Timeline bar text remains selectable: ${JSON.stringify(clipTextSelection)}`);
  }
  const bounds = await clip.boundingBox();
  if (!bounds) throw new Error('The bar has no visible bounds.');

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__timelineDragFixture.read().selection.kind === 'bar');
  const selectionOnPointerDown = await page.evaluate(() => window.__timelineDragFixture.read().selection);

  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, { steps: 8 });
  const preview = await page.evaluate(() => ({
    startTime: document.querySelector('[data-bar-time-field="start"]')?.value ?? null,
    endTime: document.querySelector('[data-bar-time-field="end"]')?.value ?? null,
    persisted: window.__timelineDragFixture.read().bar,
  }));
  await page.mouse.up();
  await page.waitForFunction(() => window.__timelineDragFixture.read().bar.startTime !== 1);
  const committed = await page.evaluate(() => ({
    ...window.__timelineDragFixture.read(),
    editorStartTime: document.querySelector('[data-bar-time-field="start"]')?.value ?? null,
    editorEndTime: document.querySelector('[data-bar-time-field="end"]')?.value ?? null,
  }));

  if (
    selectionOnPointerDown.kind !== 'bar'
    || selectionOnPointerDown.id !== 41
    || preview.startTime === null
    || preview.endTime === null
    || Number(preview.startTime) === 1
    || Math.abs((Number(preview.endTime) - Number(preview.startTime)) - 2) > 0.001
    || preview.persisted.startTime !== 1
    || Math.abs(Number(committed.editorStartTime) - committed.bar.startTime) > 0.001
    || Math.abs(Number(committed.editorEndTime) - committed.bar.endTime) > 0.001
  ) {
    throw new Error(`Timeline bar drag/editor synchronization failed: ${JSON.stringify({ selectionOnPointerDown, preview, committed })}`);
  }

  const shiftedClip = page.locator('[data-bar-id="41"]');
  const shiftedBounds = await shiftedClip.boundingBox();
  const targetLaneBounds = await page.locator('.timeline-panel__lane[data-layer="1"]').boundingBox();
  if (!shiftedBounds || !targetLaneBounds) throw new Error('The shifted drag lanes are not visible.');
  const beforeShiftDrag = committed.bar;
  await page.mouse.move(shiftedBounds.x + shiftedBounds.width / 2, shiftedBounds.y + shiftedBounds.height / 2);
  await page.mouse.down();
  await page.keyboard.down('Shift');
  await page.mouse.move(
    shiftedBounds.x + shiftedBounds.width / 2 + 100,
    targetLaneBounds.y + targetLaneBounds.height / 2,
    { steps: 8 },
  );
  const shiftedPreview = await page.evaluate(() => ({
    startTime: document.querySelector('[data-bar-time-field="start"]')?.value ?? null,
    endTime: document.querySelector('[data-bar-time-field="end"]')?.value ?? null,
  }));
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__timelineDragFixture.read().bar.layer === 1);
  const shiftedCommit = await page.evaluate(() => window.__timelineDragFixture.read().bar);
  if (
    shiftedCommit.layer !== 1
    || shiftedCommit.startTime !== beforeShiftDrag.startTime
    || shiftedCommit.endTime !== beforeShiftDrag.endTime
    || Math.abs(Number(shiftedPreview.startTime) - beforeShiftDrag.startTime) > 0.001
    || Math.abs(Number(shiftedPreview.endTime) - beforeShiftDrag.endTime) > 0.001
  ) {
    throw new Error(`Shift-drag changed bar time: ${JSON.stringify({ beforeShiftDrag, shiftedPreview, shiftedCommit })}`);
  }

  const emptyLaneBounds = await page.locator('.timeline-panel__lane[data-layer="1"]').boundingBox();
  const viewportBounds = await page.locator('.timeline-panel__viewport').boundingBox();
  if (!emptyLaneBounds || !viewportBounds) throw new Error('The empty Timeline area is not visible.');
  await page.mouse.click(viewportBounds.x + viewportBounds.width - 40, emptyLaneBounds.y + emptyLaneBounds.height / 2);
  await page.waitForFunction(() => window.__timelineDragFixture.read().selection.kind === 'none');
  const selectionAfterEmptyClick = await page.evaluate(() => window.__timelineDragFixture.read().selection);

  const beforeEndResize = await page.evaluate(() => window.__timelineDragFixture.read().bar);
  const endHandle = page.locator('[data-bar-id="41"] [data-resize-edge="end"]');
  const endHandleBounds = await endHandle.boundingBox();
  if (!endHandleBounds) throw new Error('The bar end resize handle is not visible.');
  await page.mouse.move(endHandleBounds.x + endHandleBounds.width / 2, endHandleBounds.y + endHandleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(endHandleBounds.x + endHandleBounds.width / 2 + 44, endHandleBounds.y + endHandleBounds.height / 2, { steps: 6 });
  const endResizePreview = await page.evaluate(() => ({
    startTime: Number(document.querySelector('[data-bar-time-field="start"]')?.value),
    endTime: Number(document.querySelector('[data-bar-time-field="end"]')?.value),
    persisted: window.__timelineDragFixture.read().bar,
  }));
  await page.mouse.up();
  await page.waitForFunction((previousEnd) => window.__timelineDragFixture.read().bar.endTime > previousEnd, beforeEndResize.endTime);
  const afterEndResize = await page.evaluate(() => window.__timelineDragFixture.read().bar);
  if (
    endResizePreview.startTime !== Number(beforeEndResize.startTime.toFixed(3))
    || endResizePreview.endTime <= beforeEndResize.endTime
    || endResizePreview.persisted.endTime !== beforeEndResize.endTime
    || afterEndResize.startTime !== beforeEndResize.startTime
    || afterEndResize.endTime <= beforeEndResize.endTime
  ) {
    throw new Error(`Bar end resize failed: ${JSON.stringify({ beforeEndResize, endResizePreview, afterEndResize })}`);
  }

  const beforeStartResize = afterEndResize;
  const startHandle = page.locator('[data-bar-id="41"] [data-resize-edge="start"]');
  const startHandleBounds = await startHandle.boundingBox();
  if (!startHandleBounds) throw new Error('The bar start resize handle is not visible.');
  await page.mouse.move(startHandleBounds.x + startHandleBounds.width / 2, startHandleBounds.y + startHandleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(startHandleBounds.x + startHandleBounds.width / 2 - 44, startHandleBounds.y + startHandleBounds.height / 2, { steps: 6 });
  const startResizePreview = await page.evaluate(() => ({
    startTime: Number(document.querySelector('[data-bar-time-field="start"]')?.value),
    endTime: Number(document.querySelector('[data-bar-time-field="end"]')?.value),
    persisted: window.__timelineDragFixture.read().bar,
  }));
  await page.mouse.up();
  await page.waitForFunction((previousStart) => window.__timelineDragFixture.read().bar.startTime < previousStart, beforeStartResize.startTime);
  const afterStartResize = await page.evaluate(() => window.__timelineDragFixture.read().bar);
  if (
    startResizePreview.startTime >= beforeStartResize.startTime
    || Math.abs(startResizePreview.endTime - beforeStartResize.endTime) > 0.001
    || startResizePreview.persisted.startTime !== beforeStartResize.startTime
    || afterStartResize.startTime >= beforeStartResize.startTime
    || afterStartResize.endTime !== beforeStartResize.endTime
  ) {
    throw new Error(`Bar start resize failed: ${JSON.stringify({ beforeStartResize, startResizePreview, afterStartResize })}`);
  }

  // Resizing suppresses the synthetic click immediately following pointerup.
  await page.waitForTimeout(250);
  await page.locator('[data-bar-id="42"] .timeline-panel__clip-label').click({ modifiers: ['Shift'] });
  await page.waitForFunction(() => {
    const selection = window.__timelineDragFixture.read().selection;
    return selection.kind === 'bars' && selection.ids.includes(41) && selection.ids.includes(42);
  });
  const selectionAfterShiftAdd = await page.evaluate(() => window.__timelineDragFixture.read().selection);

  await page.locator('[data-bar-id="41"] .timeline-panel__clip-label').click({ modifiers: ['Shift'] });
  await page.waitForFunction(() => {
    const selection = window.__timelineDragFixture.read().selection;
    return selection.kind === 'bar' && selection.id === 42;
  });
  const selectionAfterShiftRemove = await page.evaluate(() => window.__timelineDragFixture.read().selection);

  await page.locator('[data-bar-id="42"] .timeline-panel__clip-label').click({ modifiers: ['Shift'] });
  await page.waitForFunction(() => window.__timelineDragFixture.read().selection.kind === 'none');
  const selectionAfterShiftClear = await page.evaluate(() => window.__timelineDragFixture.read().selection);

  console.log(JSON.stringify({
    selectionOnPointerDown,
    preview,
    committed,
    shiftedPreview,
    shiftedCommit,
    selectionAfterEmptyClick,
    clipTextSelection,
    endResizePreview,
    afterEndResize,
    startResizePreview,
    afterStartResize,
    selectionAfterShiftAdd,
    selectionAfterShiftRemove,
    selectionAfterShiftClear,
  }, null, 2));
  await page.evaluate(() => window.__timelineDragFixture.dispose());
} finally {
  await browser.close();
}
