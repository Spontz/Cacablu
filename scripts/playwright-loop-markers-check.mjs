/* global process, console, window, document */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

function expectClose(actual, expected, label, tolerance = 0.15) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.evaluate(async () => {
    const [
      { createTimelinePanel },
      { createMarkersPanel },
      { createAppState },
      { createDbState },
      { createUndoManager },
    ] = await Promise.all([
      import('/src/panels/timeline-panel.ts'),
      import('/src/panels/markers-panel.ts'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const db = {
      variables: new Map([['endTime', '12']]),
      bars: [
        {
          id: 1,
          name: 'fixture',
          layer: 0,
          startTime: 0,
          endTime: 1,
          enabled: true,
          type: 'scene',
          script: '',
          content: '',
          srcBlending: 'ONE',
          dstBlending: 'ZERO',
          blendingEQ: 'ADD',
        },
      ],
      fbos: [],
      files: [],
      folders: [],
      markers: [],
    };

    let nextMarkerId = 1;
    const sortMarkers = () => db.markers.sort((left, right) => left.time - right.time || left.id - right.id);
    const clone = (marker) => ({ id: marker.id, time: marker.time, label: marker.label });
    const session = {
      fileName: 'fixture.sqlite',
      data: db,
      insertTimelineMarker(input) {
        const marker = {
          id: Number.isInteger(input.id) ? input.id : nextMarkerId,
          time: input.time,
          label: input.label ?? '',
        };
        nextMarkerId = Math.max(nextMarkerId, marker.id + 1);
        db.markers.push(marker);
        sortMarkers();
        return marker;
      },
      updateTimelineMarker(markerId, input) {
        const marker = db.markers.find((candidate) => candidate.id === markerId);
        if (!marker) throw new Error(`Missing marker ${markerId}`);
        if (Object.hasOwn(input, 'time')) marker.time = input.time;
        if (Object.hasOwn(input, 'label')) marker.label = input.label;
        sortMarkers();
        return marker;
      },
      deleteTimelineMarker(markerId) {
        const index = db.markers.findIndex((candidate) => candidate.id === markerId);
        if (index < 0) throw new Error(`Missing marker ${markerId}`);
        const [marker] = db.markers.splice(index, 1);
        return clone(marker);
      },
      restoreTimelineMarker(marker) {
        db.markers.push(clone(marker));
        nextMarkerId = Math.max(nextMarkerId, marker.id + 1);
        sortMarkers();
        return marker;
      },
    };

    const appState = createAppState();
    const dbState = createDbState();
    const undoManager = createUndoManager();
    const sessionRef = { current: session };
    const connection = {
      isConnected: () => false,
      subscribeRuntime: () => () => {},
      subscribeAssets: () => () => {},
      send(message) {
        window.__markerFixture.sent.push(message);
      },
    };

    window.__markerFixture = { db, undoManager, sent: [] };

    const root = document.querySelector('#app');
    root.innerHTML = '';
    root.style.display = 'grid';
    root.style.gridTemplateRows = '1fr 180px';
    root.style.height = '100vh';

    const timeline = createTimelinePanel(appState, dbState, sessionRef, connection, undoManager);
    const markers = createMarkersPanel(dbState, sessionRef, undoManager);
    root.append(timeline.element, markers.element);
    timeline.init({});
    markers.init({});
    dbState.setOpen('fixture.sqlite');
  });

  const ruler = page.locator('.timeline-panel__ruler');
  await ruler.waitFor();

  async function clickRulerAt(time, zone) {
    const box = await ruler.boundingBox();
    if (!box) throw new Error('Missing ruler box');
    await page.mouse.click(box.x + time * 88, box.y + box.height * (zone === 'lower' ? 0.75 : 0.25));
  }

  await clickRulerAt(2, 'lower');
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 1);
  let markers = await page.evaluate(() => window.__markerFixture.db.markers.map((marker) => ({ ...marker })));
  expectClose(markers[0].time, 2, 'created marker time');

  const marker = page.locator('[data-marker-id]').first();
  let markerBox = await marker.boundingBox();
  if (!markerBox) throw new Error('Missing marker after create');
  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(markerBox.x + markerBox.width / 2 + 88, markerBox.y + markerBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(window.__markerFixture.db.markers[0].time - 3) < 0.15);

  await page.keyboard.press('Delete');
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 0);
  await page.evaluate(() => window.__markerFixture.undoManager.undo());
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 1);
  markers = await page.evaluate(() => window.__markerFixture.db.markers.map((marker) => ({ ...marker })));
  expectClose(markers[0].time, 3, 'undo-restored marker time');

  await page.waitForTimeout(250);
  await clickRulerAt(7, 'lower');
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 2);

  const firstTimeInput = page.locator('.markers-panel__input--time').first();
  await firstTimeInput.fill('4');
  await firstTimeInput.press('Enter');
  await page.waitForFunction(() => Math.abs(window.__markerFixture.db.markers[0].time - 4) < 0.001);

  const firstLabelInput = page.locator('.markers-panel__row').first().locator('.markers-panel__input').first();
  await firstLabelInput.fill('Loop A');
  await firstLabelInput.press('Enter');
  await page.waitForFunction(() => window.__markerFixture.db.markers[0].label === 'Loop A');

  await clickRulerAt(5, 'upper');
  await page.waitForSelector('.timeline-panel__loop-range');
  const loop = await page.locator('.timeline-panel__loop-range').evaluate((node) => ({
    left: Number.parseFloat(node.style.left),
    width: Number.parseFloat(node.style.width),
  }));
  expectClose(loop.left / 88, 4, 'upper-zone loop start');
  expectClose((loop.left + loop.width) / 88, 7, 'upper-zone loop end');

  await clickRulerAt(1, 'upper');
  const fallback = await page.locator('.timeline-panel__loop-range').evaluate((node) => ({
    left: Number.parseFloat(node.style.left),
    width: Number.parseFloat(node.style.width),
  }));
  expectClose(fallback.left / 88, 0, 'fallback loop start');
  expectClose((fallback.left + fallback.width) / 88, 4, 'fallback loop end');

  const result = await page.evaluate(() => ({
    markers: window.__markerFixture.db.markers,
    sent: window.__markerFixture.sent,
    dirty: document.body.textContent.includes('Loop A'),
  }));

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
