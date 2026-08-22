/* global process, console, window, document */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 700 } });
page.setDefaultTimeout(30_000);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ createTimelinePanel }, { createAppState }, { createDbState }, { createUndoManager }] = await Promise.all([
      import('/src/panels/timeline-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const bars = [
      {
        id: 41, name: 'First', type: 'drawImage', layer: 0, startTime: 1, endTime: 3,
        enabled: true, selected: false, script: '', srcBlending: 'ONE', dstBlending: 'ZERO',
        blendingEQ: 'ADD', srcAlpha: '', dstAlpha: '',
      },
      {
        id: 42, name: 'Second', type: 'drawImage', layer: 1, startTime: 2, endTime: 4,
        enabled: true, selected: false, script: '', srcBlending: 'ONE', dstBlending: 'ZERO',
        blendingEQ: 'ADD', srcAlpha: '', dstAlpha: '',
      },
    ];
    const session = {
      fileName: 'marker-snap-fixture.sqlite',
      data: {
        variables: new Map([['startTime', '0'], ['endTime', '12']]),
        bars,
        fbos: [],
        files: [],
        folders: [],
        markers: [
          { id: 1, time: 5, label: 'Single snap', enabled: true },
          { id: 2, time: 10, label: 'Group snap', enabled: true },
          { id: 3, time: 6, label: 'Disabled', enabled: false },
          { id: 4, time: 0.5, label: 'Single start', enabled: true },
          { id: 5, time: 1.5, label: 'Group start', enabled: true },
        ],
      },
      updateCell(table, rowId, column, value) {
        const target = table === 'bars' ? bars.find((bar) => bar.id === rowId) : null;
        if (!target) throw new Error(`Unexpected update ${table}.${rowId}.${column}`);
        target[column] = value;
      },
    };
    const state = createAppState();
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const connection = {
      isConnected: () => false,
      send: () => {},
      subscribeRuntime: () => () => {},
    };
    dbState.setOpen(session.fileName);
    const timeline = createTimelinePanel(state, dbState, { current: session }, connection, undoManager);
    document.body.replaceChildren(timeline.element);
    timeline.element.style.height = '500px';
    timeline.init({});
    state.setResourceSelection({ kind: 'bar', id: 41 });

    window.__markerSnapFixture = {
      read: () => ({
        bars: bars.map((bar) => ({ id: bar.id, startTime: bar.startTime, endTime: bar.endTime })),
        selection: state.getSnapshot().resourceSelection,
        canUndo: undoManager.canUndo(),
      }),
      selectOne: () => state.setResourceSelection({ kind: 'bar', id: 41 }),
      selectBoth: () => state.setResourceSelection({ kind: 'bars', ids: [41, 42] }),
      undo: () => undoManager.undo(),
      dispose: () => timeline.dispose(),
    };
  });

  async function resizeEdgeNearMarker(barId, markerId, edge) {
    const handle = page.locator(`[data-bar-id="${barId}"] [data-resize-edge="${edge}"]`);
    const guide = page.locator(`[data-marker-guide-id="${markerId}"]`);
    const handleBounds = await handle.boundingBox();
    const guideBounds = await guide.boundingBox();
    if (!handleBounds || !guideBounds) throw new Error(`Missing geometry for bar ${barId} and marker ${markerId}`);
    const y = handleBounds.y + handleBounds.height / 2;
    await page.mouse.move(handleBounds.x + handleBounds.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(guideBounds.x - 2, y, { steps: 8 });
    await page.keyboard.down('Shift');
    await page.waitForFunction((id) => (
      document.querySelector(`[data-marker-id="${id}"].is-snap-target`)
      && document.querySelector(`.timeline-panel__clip.is-snapped-${id === 4 || id === 5 ? 'start' : 'end'}`)
    ), markerId);
  }

  await resizeEdgeNearMarker(41, 1, 'end');
  const singlePreview = await page.evaluate(() => ({
    target: document.querySelector('[data-marker-id="1"]')?.classList.contains('is-snap-target'),
    snapped: document.querySelector('[data-bar-id="41"]')?.classList.contains('is-snapped-end'),
    persisted: window.__markerSnapFixture.read().bars,
  }));
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => !document.querySelector('.timeline-panel__loop-marker.is-snap-target'));
  const releasedPreview = await page.evaluate(() => ({
    target: Boolean(document.querySelector('.timeline-panel__loop-marker.is-snap-target')),
    snapped: Boolean(document.querySelector('.timeline-panel__clip.is-snapped-end')),
  }));
  await page.keyboard.down('Shift');
  await page.waitForFunction(() => Boolean(document.querySelector('[data-marker-id="1"].is-snap-target')));
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__markerSnapFixture.read().bars[0].endTime === 5);
  const singleCommit = await page.evaluate(() => window.__markerSnapFixture.read());

  await page.evaluate(() => window.__markerSnapFixture.selectBoth());
  await page.waitForFunction(() => document.querySelectorAll('.timeline-panel__clip.is-selected').length === 2);
  await resizeEdgeNearMarker(41, 2, 'end');
  const multiPreview = await page.evaluate(() => ({
    snappedBars: document.querySelectorAll('.timeline-panel__clip.is-snapped-end').length,
    persisted: window.__markerSnapFixture.read().bars,
  }));
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__markerSnapFixture.read().bars.every((bar) => bar.endTime === 10));
  const multiCommit = await page.evaluate(() => window.__markerSnapFixture.read());

  await page.evaluate(() => window.__markerSnapFixture.undo());
  await page.waitForFunction(() => {
    const bars = window.__markerSnapFixture.read().bars;
    return bars[0].endTime === 5 && bars[1].endTime === 4;
  });
  const afterUndo = await page.evaluate(() => window.__markerSnapFixture.read());

  await page.evaluate(() => window.__markerSnapFixture.selectOne());
  await page.waitForFunction(() => document.querySelectorAll('.timeline-panel__clip.is-selected').length === 1);
  await resizeEdgeNearMarker(41, 4, 'start');
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__markerSnapFixture.read().bars[0].startTime === 0.5);
  const singleStartCommit = await page.evaluate(() => window.__markerSnapFixture.read());

  await page.evaluate(() => window.__markerSnapFixture.selectBoth());
  await page.waitForFunction(() => document.querySelectorAll('.timeline-panel__clip.is-selected').length === 2);
  await resizeEdgeNearMarker(41, 5, 'start');
  const multiStartPreview = await page.locator('.timeline-panel__clip.is-snapped-start').count();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.waitForFunction(() => window.__markerSnapFixture.read().bars.every((bar) => bar.startTime === 1.5));
  const multiStartCommit = await page.evaluate(() => window.__markerSnapFixture.read());

  if (
    singlePreview.target !== true
    || singlePreview.snapped !== true
    || releasedPreview.target !== false
    || releasedPreview.snapped !== false
    || singlePreview.persisted[0].endTime !== 3
    || singleCommit.bars[0].endTime !== 5
    || multiPreview.snappedBars !== 2
    || multiPreview.persisted[0].endTime !== 5
    || multiPreview.persisted[1].endTime !== 4
    || multiCommit.bars.some((bar) => bar.endTime !== 10)
    || afterUndo.bars[0].endTime !== 5
    || afterUndo.bars[1].endTime !== 4
    || singleStartCommit.bars[0].startTime !== 0.5
    || singleStartCommit.bars[1].startTime !== 2
    || multiStartPreview !== 2
    || multiStartCommit.bars.some((bar) => bar.startTime !== 1.5)
  ) {
    throw new Error(`Timeline marker snap failed: ${JSON.stringify({ singlePreview, releasedPreview, singleCommit, multiPreview, multiCommit, afterUndo, singleStartCommit, multiStartPreview, multiStartCommit })}`);
  }

  console.log(JSON.stringify({ singlePreview, releasedPreview, singleCommit, multiPreview, multiCommit, afterUndo, singleStartCommit, multiStartPreview, multiStartCommit }, null, 2));
  await page.evaluate(() => window.__markerSnapFixture.dispose());
} finally {
  await browser.close();
}
