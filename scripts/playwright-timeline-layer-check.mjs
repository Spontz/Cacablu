/* global process, console, window, File, fetch, document, KeyboardEvent, Event */

import { access } from 'node:fs/promises';
import { chromium } from 'playwright';

const projectPath = process.env.CACABLU_PROJECT_PATH;
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';

if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a real Cacablu SQLite project.');
await access(projectPath);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

const alerts = [];
const pageErrors = [];
page.on('dialog', async (dialog) => {
  alerts.push(dialog.message());
  await dialog.dismiss();
});
page.on('pageerror', (error) => pageErrors.push(error.message));

function readLayers() {
  return page.locator('.timeline-panel__lane').evaluateAll((lanes) => lanes
    .map((lane) => Number(lane.getAttribute('data-layer')))
    .filter(Number.isInteger)
    .sort((left, right) => left - right));
}

async function dragAcrossVisibleLane(layer) {
  const lane = page.locator(`.timeline-panel__lane[data-layer="${layer}"]`);
  const viewport = page.locator('.timeline-panel__viewport');
  const [laneBounds, viewportBounds] = await Promise.all([lane.boundingBox(), viewport.boundingBox()]);
  if (!laneBounds || !viewportBounds) throw new Error(`Layer ${layer} is not visible.`);

  const y = laneBounds.y + laneBounds.height / 2;
  const startX = viewportBounds.x + viewportBounds.width * 0.6;
  const endX = viewportBounds.x + viewportBounds.width * 0.8;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 8 });
  await page.mouse.up();
}

try {
  await page.route('**/__playwright_project.sqlite', (route) => route.fulfill({
    path: projectPath,
    contentType: 'application/x-sqlite3',
  }));
  await page.addInitScript(() => {
    const createHandle = () => ({
      kind: 'file',
      name: 'playwright-project.sqlite',
      getFile: async () => new File(
        [await (await fetch('/__playwright_project.sqlite')).arrayBuffer()],
        'playwright-project.sqlite',
        { type: 'application/x-sqlite3' },
      ),
    });
    window.showOpenFilePicker = async () => [createHandle()];
    window.showSaveFilePicker = async () => createHandle();
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const timelineTrigger = page.locator('.menu-bar__trigger', { hasText: 'Timeline' });
  await timelineTrigger.click();
  const newLayerAction = page.locator('.menu-bar__item', { hasText: 'New Layer' });
  const newLayerActionCount = await newLayerAction.count();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+O');
  await page.locator('.timeline-panel__lane').first().waitFor({ state: 'visible' });
  const initialLayers = await readLayers();
  const surfaceCoverage = await page.evaluate(() => {
    const viewport = document.querySelector('.timeline-panel__viewport');
    const ruler = document.querySelector('.timeline-panel__ruler');
    const lanes = [...document.querySelectorAll('.timeline-panel__lane')];
    const lastLane = lanes.at(-1);
    if (!viewport || !ruler || !lastLane) return null;
    const viewportBounds = viewport.getBoundingClientRect();
    const rulerBounds = ruler.getBoundingClientRect();
    const lastLaneBounds = lastLane.getBoundingClientRect();
    const bottomVisibleLane = lanes.findLast((lane) => {
      const bounds = lane.getBoundingClientRect();
      return bounds.top < viewportBounds.bottom && bounds.bottom > rulerBounds.bottom;
    });
    return {
      usableTop: rulerBounds.bottom,
      usableBottom: viewportBounds.bottom,
      laneBottom: lastLaneBounds.bottom,
      visibleLayerCapacity: Math.ceil((viewportBounds.bottom - rulerBounds.bottom) / lastLaneBounds.height),
      bottomVisibleLayer: Number(bottomVisibleLane?.getAttribute('data-layer')),
    };
  });
  if (!surfaceCoverage || surfaceCoverage.laneBottom < surfaceCoverage.usableBottom - 18) {
    throw new Error(`Timeline lanes do not cover the visible surface: ${JSON.stringify(surfaceCoverage)}`);
  }

  const createdLayer = surfaceCoverage.bottomVisibleLayer;
  if (!Number.isInteger(createdLayer)) throw new Error('Could not identify the bottom visible Timeline layer.');
  await dragAcrossVisibleLane(createdLayer);
  await page.waitForFunction((layer) => document.querySelector(`.timeline-panel__lane[data-layer="${layer}"] .timeline-panel__clip`), createdLayer);
  const createdBar = await page.locator(`.timeline-panel__lane[data-layer="${createdLayer}"] .timeline-panel__clip`).last().evaluate((clip) => ({
    barId: Number(clip.getAttribute('data-bar-id')),
    layer: Number(clip.closest('.timeline-panel__lane')?.getAttribute('data-layer')),
    width: clip.getBoundingClientRect().width,
  }));
  const postCreationLayers = await readLayers();
  const postCreationMax = Math.max(...postCreationLayers);
  if (postCreationMax < createdLayer + surfaceCoverage.visibleLayerCapacity) {
    throw new Error(`Timeline did not retain a full unused window below layer ${createdLayer}.`);
  }
  const scrollAccess = await page.evaluate(async () => {
    const viewport = document.querySelector('.timeline-panel__viewport');
    const lastLane = document.querySelector('.timeline-panel__lane:last-child');
    const grid = document.querySelector('.timeline-panel__grid');
    const gridLine = document.querySelector('.timeline-panel__grid-line');
    if (!viewport || !lastLane || !grid || !gridLine) return null;
    const maximumScrollTop = viewport.scrollHeight - viewport.clientHeight;
    viewport.scrollTop = maximumScrollTop;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    const viewportBounds = viewport.getBoundingClientRect();
    const lastLaneBounds = lastLane.getBoundingClientRect();
    const gridBounds = grid.getBoundingClientRect();
    const gridLineBounds = gridLine.getBoundingClientRect();
    const result = {
      maximumScrollTop,
      actualScrollTop: viewport.scrollTop,
      lastLaneVisible: lastLaneBounds.top < viewportBounds.bottom && lastLaneBounds.bottom > viewportBounds.top,
      gridCoversLastLane: gridBounds.bottom >= lastLaneBounds.bottom - 1,
      gridLineVisible: gridLineBounds.top < viewportBounds.bottom && gridLineBounds.bottom > viewportBounds.top,
    };
    viewport.scrollTop = 0;
    return result;
  });
  if (
    !scrollAccess
    || scrollAccess.maximumScrollTop <= 0
    || !scrollAccess.lastLaneVisible
    || !scrollAccess.gridCoversLastLane
    || !scrollAccess.gridLineVisible
  ) {
    throw new Error(`Unused Timeline layers are not reachable by scrolling: ${JSON.stringify(scrollAccess)}`);
  }

  await page.evaluate(() => window.dispatchEvent(new Event('cacablu:timeline-bars-changed')));
  const rerenderLayers = await readLayers();

  const shortcutPrevented = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  const shortcutLayers = await readLayers();

  await page.keyboard.press('Control+O');
  await page.waitForFunction((expectedLayers) => {
    const layers = [...document.querySelectorAll('.timeline-panel__lane')]
      .map((lane) => Number(lane.getAttribute('data-layer')))
      .filter(Number.isInteger)
      .sort((left, right) => left - right);
    return JSON.stringify(layers) === JSON.stringify(expectedLayers);
  }, initialLayers);
  const reopenedLayers = await readLayers();

  if (newLayerActionCount !== 0
    || JSON.stringify(rerenderLayers) !== JSON.stringify(postCreationLayers)
    || shortcutPrevented
    || JSON.stringify(shortcutLayers) !== JSON.stringify(postCreationLayers)
    || JSON.stringify(reopenedLayers) !== JSON.stringify(initialLayers)
    || !Number.isInteger(createdBar.barId)
    || createdBar.layer !== createdLayer
    || createdBar.width <= 1
    || alerts.length > 0
    || pageErrors.length > 0) {
    throw new Error(`Timeline layer workflow failed: ${JSON.stringify({
      initialLayers,
      postCreationLayers,
      newLayerActionCount,
      rerenderLayers,
      shortcutPrevented,
      shortcutLayers,
      reopenedLayers,
      surfaceCoverage,
      scrollAccess,
      createdBar,
      alerts,
      pageErrors,
    })}`);
  }

  console.log(JSON.stringify({
    initialLayers,
    postCreationLayers,
    newLayerActionCount,
    rerenderLayers,
    shortcutPrevented,
    shortcutLayers,
    reopenedLayers,
    surfaceCoverage,
    scrollAccess,
    createdBar,
  }, null, 2));
} finally {
  await browser.close();
}
