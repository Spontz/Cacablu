/* global process, console, window, document, CustomEvent, HTMLElement, getComputedStyle, setTimeout */

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
  await page.route('http://127.0.0.1:29100/api/runtime/loop', async (route) => {
    const body = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestId: typeof body?.requestId === 'string' ? body.requestId : '',
        ok: true,
        startTime: body?.startTime,
        endTime: body?.endTime,
      }),
    });
  });

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
      import('/src/panels/markers-panel.tsx'),
      import('/src/state/app-state.ts'),
      import('/src/state/db-state.ts'),
      import('/src/app/undo-manager.ts'),
    ]);

    const db = {
      variables: new Map(),
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
      markers: [{ id: 99, time: 40, label: 'Persisted', enabled: true }],
    };

    let nextMarkerId = 100;
    const sortMarkers = () => db.markers.sort((left, right) => left.time - right.time || left.id - right.id);
    const clone = (marker) => ({ id: marker.id, time: marker.time, label: marker.label, enabled: marker.enabled !== false });
    const session = {
      fileName: 'fixture.sqlite',
      data: db,
      insertTimelineMarker(input) {
        const marker = {
          id: Number.isInteger(input.id) ? input.id : nextMarkerId,
          time: input.time,
          label: input.label ?? '',
          enabled: input.enabled ?? true,
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
        if (Object.hasOwn(input, 'enabled')) marker.enabled = input.enabled;
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
    const runtimeListeners = new Set();
    const connection = {
      isConnected: () => window.__markerFixture?.connected === true,
      subscribeRuntime(listener) {
        runtimeListeners.add(listener);
        return () => runtimeListeners.delete(listener);
      },
      subscribeAssets: () => () => {},
      send(message) {
        window.__markerFixture.sent.push(message);
      },
    };

    window.__markerFixture = {
      db,
      undoManager,
      sent: [],
      connected: false,
      openedMarkerId: null,
      emitRuntime(runtime) {
        for (const listener of runtimeListeners) listener(runtime);
      },
      resetForEditing() {
        db.variables.set('endTime', '12');
        db.markers.length = 0;
        nextMarkerId = 1;
        dbState.setOpen('fixture-reset.sqlite');
      },
    };

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
    window.addEventListener('cacablu:open-markers-panel', (event) => {
      const markerId = event.detail?.markerId;
      window.__markerFixture.openedMarkerId = markerId;
      window.dispatchEvent(new CustomEvent('cacablu:markers-panel-select', {
        detail: { markerId },
      }));
    });
    dbState.setOpen('fixture.sqlite');
  });

  const ruler = page.locator('.timeline-panel__ruler');
  await ruler.waitFor();

  await page.waitForSelector('[data-marker-id="99"]');
  const persistedMarker = await page.locator('.timeline-panel__loop-marker[data-marker-id="99"]').boundingBox();
  const initialRuler = await ruler.boundingBox();
  if (!persistedMarker || !initialRuler) {
    throw new Error('Persisted marker did not render on initial load.');
  }
  const initialRulerWidth = await ruler.evaluate((node) => node.getBoundingClientRect().width);
  if (initialRulerWidth < 40 * 88) {
    throw new Error(`Initial timeline did not expand to persisted marker time: ${initialRulerWidth}`);
  }

  await page.evaluate(() => window.__markerFixture.resetForEditing());
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 0);

  async function clickRulerAt(time, zone, options = {}) {
    const box = await ruler.boundingBox();
    if (!box) throw new Error('Missing ruler box');
    const modifiers = options.modifiers ?? [];
    for (const modifier of modifiers) {
      await page.keyboard.down(modifier);
    }
    await page.mouse.click(
      box.x + time * 88,
      box.y + box.height * (zone === 'lower' ? 0.75 : 0.25),
    );
    for (const modifier of [...modifiers].reverse()) {
      await page.keyboard.up(modifier);
    }
  }

  async function activateLoopAt(time) {
    if (await page.locator('.timeline-panel__loop-range').count() > 0) {
      await clickRulerAt(time, 'lower');
    }
    await clickRulerAt(time, 'lower');
  }

  await clickRulerAt(2, 'lower');
  await page.waitForTimeout(100);
  let markerCount = await page.evaluate(() => window.__markerFixture.db.markers.length);
  if (markerCount !== 0) {
    throw new Error(`Expected normal lower-zone click not to create a marker, got ${markerCount}`);
  }
  // The normal lower-zone click toggles a loop even while Phoenix is offline.
  // Clear it so the later connected activation starts from a known state.
  await clickRulerAt(2, 'lower');

  await clickRulerAt(2, 'lower', { modifiers: ['Shift'] });
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
  await clickRulerAt(7, 'upper', { modifiers: ['Shift'] });
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 2);

  await page.locator('.markers-panel__option[data-marker-option-id="1"]').click();

  const timeInput = page.getByLabel('Time');
  await timeInput.fill('4');
  await timeInput.press('Enter');
  await page.waitForFunction(() => Math.abs(window.__markerFixture.db.markers[0].time - 4) < 0.001);

  const labelInput = page.getByLabel('Label');
  await labelInput.fill('Loop A');
  await labelInput.press('Enter');
  await page.waitForFunction(() => window.__markerFixture.db.markers[0].label === 'Loop A');

  await page.getByPlaceholder('Search markers').fill('loop');
  await page.waitForSelector('.markers-panel__option[data-marker-option-id="1"]');
  const filteredOptionCount = await page.locator('.markers-panel__option').count();
  if (filteredOptionCount !== 1) {
    throw new Error(`Expected quick search to show one marker, got ${filteredOptionCount}`);
  }
  await page.getByPlaceholder('Search markers').fill('');

  await page.locator('.timeline-panel__loop-marker[data-marker-id="1"]').dblclick();
  await page.waitForFunction(() => window.__markerFixture.openedMarkerId === 1);
  await page.waitForSelector('.markers-panel__option[data-combobox-active="true"][data-marker-option-id="1"]');
  const focusedMarkerInput = await page.evaluate(() => document.activeElement?.closest('.markers-panel__editor') ? '1' : null);
  if (focusedMarkerInput !== '1') {
    throw new Error('Expected marker 1 editor to receive focus.');
  }

  await page.evaluate(() => {
    window.__markerFixture.connected = true;
    window.__markerFixture.sent.length = 0;
  });
  await activateLoopAt(5);
  const immediateLoopStartSeek = await page.evaluate(() => window.__markerFixture.sent.some((message) => (
    message.type === 'runtime.seek' && Math.abs(message.time - 4) < 0.001
  )));
  if (!immediateLoopStartSeek) {
    throw new Error('Expected loop activation to seek to its start before Phoenix acknowledged the loop.');
  }
  const immediatePlayheadTime = await page.locator('.timeline-panel__playhead').evaluate((node) => (
    Number.parseFloat(node.style.left) / 88
  ));
  expectClose(immediatePlayheadTime, 4, 'immediate loop activation playhead', 0.01);
  await page.waitForSelector('.timeline-panel__loop-range');
  await page.waitForFunction(() => window.__markerFixture.sent.some((message) => (
    message.type === 'runtime.seek' && Math.abs(message.time - 4) < 0.001
  )));
  const loopRangeCount = await page.locator('.timeline-panel__loop-range').count();
  if (loopRangeCount !== 1) {
    throw new Error(`Expected active loop to render one lower indicator, got ${loopRangeCount}`);
  }
  const lowerLoopRangeCount = await page.locator('.timeline-panel__loop-range--lower').count();
  if (lowerLoopRangeCount !== 1) {
    throw new Error(`Expected active loop indicator to be lower, got ${lowerLoopRangeCount}`);
  }
  const loop = await page.locator('.timeline-panel__loop-range').first().evaluate((node) => ({
    left: Number.parseFloat(node.style.left),
    width: Number.parseFloat(node.style.width),
  }));
  expectClose(loop.left / 88, 4, 'lower-zone loop start');
  expectClose((loop.left + loop.width) / 88, 7, 'lower-zone loop end');

  await page.evaluate(() => {
    window.__markerFixture.emitRuntime({
      time: 6.95,
      playing: true,
      fps: 60,
      startTime: 4,
      endTime: 7,
      receivedAt: Date.now(),
    });
  });
  await page.waitForTimeout(250);
  const wrappedPlaybackTime = Number.parseFloat(await page.locator('.timeline-panel__playhead span').innerText());
  if (wrappedPlaybackTime < 4 || wrappedPlaybackTime >= 7) {
    throw new Error(`Expected interpolated playback time to stay inside [4, 7), got ${wrappedPlaybackTime}`);
  }

  await page.evaluate(() => {
    window.__markerFixture.emitRuntime({
      time: 5,
      playing: false,
      fps: 60,
      startTime: 4,
      endTime: 7,
      receivedAt: Date.now(),
    });
  });
  await clickRulerAt(6, 'lower', { modifiers: ['Shift'] });
  await page.waitForFunction(() => window.__markerFixture.db.markers.some((candidate) => Math.abs(candidate.time - 6) < 0.15));
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 4) < 0.15 && Math.abs(end - 6) < 0.15;
  });
  await page.evaluate(() => window.__markerFixture.undoManager.undo());
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 2);

  await page.evaluate(() => {
    window.__markerFixture.emitRuntime({
      time: 6,
      playing: false,
      fps: 60,
      startTime: 4,
      endTime: 7,
      receivedAt: Date.now(),
    });
  });
  await clickRulerAt(5, 'lower', { modifiers: ['Shift'] });
  await page.waitForFunction(() => window.__markerFixture.db.markers.some((candidate) => Math.abs(candidate.time - 5) < 0.15));
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 5) < 0.15 && Math.abs(end - 7) < 0.15;
  });
  await page.evaluate(() => window.__markerFixture.undoManager.undo());
  await page.waitForFunction(() => window.__markerFixture.db.markers.length === 2);
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 4) < 0.15 && Math.abs(end - 7) < 0.15;
  });

  const enabledCheckbox = page.getByLabel('Enabled');
  await enabledCheckbox.uncheck();
  await page.waitForFunction(() => window.__markerFixture.db.markers.find((marker) => marker.id === 1)?.enabled === false);
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    return Math.abs(Number.parseFloat(range.style.left)) < 0.001
      && Math.abs(Number.parseFloat(range.style.width) / 88 - 7) < 0.15;
  });
  await page.waitForSelector('.timeline-panel__loop-marker[data-marker-id="1"].is-disabled');
  const disabledAnimation = await page.locator('.timeline-panel__loop-guide[data-marker-guide-id="1"]')
    .evaluate((node) => getComputedStyle(node, '::after').animationName);
  if (disabledAnimation !== 'none') {
    throw new Error(`Expected disabled marker animation to be none, got ${disabledAnimation}`);
  }
  await enabledCheckbox.check();
  await page.waitForFunction(() => window.__markerFixture.db.markers.find((marker) => marker.id === 1)?.enabled === true);

  await page.evaluate(() => {
    window.__markerFixture.emitRuntime({
      time: 5.5,
      playing: false,
      fps: 60,
      startTime: 4,
      endTime: 7,
      receivedAt: Date.now(),
    });
    window.__markerFixture.sent.length = 0;
  });
  const movedMarker = page.locator('.timeline-panel__loop-marker[data-marker-id="1"]');
  const movedMarkerBox = await movedMarker.boundingBox();
  if (!movedMarkerBox) throw new Error('Missing marker before active-loop move');
  await page.mouse.move(movedMarkerBox.x + movedMarkerBox.width / 2, movedMarkerBox.y + movedMarkerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movedMarkerBox.x + movedMarkerBox.width / 2 - 88, movedMarkerBox.y + movedMarkerBox.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(window.__markerFixture.db.markers.find((marker) => marker.id === 1)?.time - 3) < 0.15);
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 3) < 0.15 && Math.abs(end - 7) < 0.15;
  });
  await page.waitForTimeout(250);
  const markerMoveSeekCount = await page.evaluate(() => window.__markerFixture.sent.filter((message) => (
    message.type === 'runtime.seek'
  )).length);
  if (markerMoveSeekCount !== 0) {
    throw new Error(`Expected marker move to send no runtime seek, got ${markerMoveSeekCount}`);
  }
  const timeAfterMarkerMove = Number.parseFloat(await page.locator('.timeline-panel__playhead span').innerText());
  expectClose(timeAfterMarkerMove, 5.5, 'playhead after active-loop marker move', 0.001);

  await page.locator('.panel--timeline').focus();
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => !window.__markerFixture.db.markers.some((marker) => marker.id === 1));
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    return Math.abs(Number.parseFloat(range.style.left)) < 0.001
      && Math.abs(Number.parseFloat(range.style.width) / 88 - 7) < 0.15;
  });

  await page.evaluate(() => window.__markerFixture.undoManager.undo());
  await page.waitForFunction(() => window.__markerFixture.db.markers.some((marker) => marker.id === 1));
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 3) < 0.15 && Math.abs(end - 7) < 0.15;
  });

  await page.evaluate(() => window.__markerFixture.undoManager.undo());
  await page.waitForFunction(() => Math.abs(window.__markerFixture.db.markers.find((marker) => marker.id === 1)?.time - 4) < 0.15);
  await page.waitForFunction(() => {
    const range = document.querySelector('.timeline-panel__loop-range');
    if (!(range instanceof HTMLElement)) return false;
    const left = Number.parseFloat(range.style.left) / 88;
    const end = (Number.parseFloat(range.style.left) + Number.parseFloat(range.style.width)) / 88;
    return Math.abs(left - 4) < 0.15 && Math.abs(end - 7) < 0.15;
  });

  await page.evaluate(() => {
    window.__markerFixture.emitRuntime({
      time: 5,
      playing: false,
      fps: 60,
      startTime: 4,
      endTime: 7,
      receivedAt: Date.now(),
    });
  });
  const widthAfterRuntimeLoop = await ruler.evaluate((node) => node.getBoundingClientRect().width);
  if (widthAfterRuntimeLoop < 12 * 88) {
    throw new Error(`Expected runtime loop state not to shrink timeline duration, got width ${widthAfterRuntimeLoop}`);
  }

  await page.evaluate(() => {
    window.__markerFixture.sent.length = 0;
  });
  await activateLoopAt(8);
  await page.waitForFunction(() => window.__markerFixture.sent.some((message) => (
    message.type === 'runtime.seek' && Math.abs(message.time - 7) < 0.001
  )));
  const nextLoop = await page.locator('.timeline-panel__loop-range').first().evaluate((node) => ({
    left: Number.parseFloat(node.style.left),
    width: Number.parseFloat(node.style.width),
  }));
  expectClose(nextLoop.left / 88, 7, 'post-runtime-state loop start');
  expectClose((nextLoop.left + nextLoop.width) / 88, 12, 'post-runtime-state loop end');

  await activateLoopAt(1);
  const fallback = await page.locator('.timeline-panel__loop-range').first().evaluate((node) => ({
    left: Number.parseFloat(node.style.left),
    width: Number.parseFloat(node.style.width),
  }));
  expectClose(fallback.left / 88, 0, 'fallback loop start');
  expectClose((fallback.left + fallback.width) / 88, 4, 'fallback loop end');

  await page.evaluate(() => {
    window.__markerFixture.sent.length = 0;
  });
  await page.locator('.panel--timeline').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__markerFixture.sent.some((message) => message.type === 'runtime.toggle'));

  const result = await page.evaluate(() => ({
    markers: window.__markerFixture.db.markers,
    sent: window.__markerFixture.sent,
    dirty: document.body.textContent.includes('Loop A'),
  }));

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
