/* global process, console, window, File, fetch, document */

import { access } from 'node:fs/promises';
import { chromium } from 'playwright';

const projectPath = process.env.CACABLU_PROJECT_PATH;
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';

if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a real Cacablu SQLite project.');
await access(projectPath);

const browser = await chromium.launch({ channel: 'msedge', headless: false });
const page = await browser.newPage();
page.setDefaultTimeout(30_000);

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
  await page.keyboard.press('Control+O');
  await page.locator('.timeline-panel__lane').first().waitFor({ state: 'visible' });

  const viewport = page.locator('.timeline-panel__viewport');
  const before = await viewport.evaluate((element) => ({
    currentTime: document.querySelector('.timeline-panel__playhead span')?.textContent,
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    offsetWidth: element.offsetWidth,
    offsetHeight: element.offsetHeight,
    scrollWidth: element.scrollWidth,
  }));
  const bounds = await viewport.boundingBox();
  if (!bounds || before.scrollWidth <= before.clientWidth || before.offsetHeight <= before.clientHeight) {
    throw new Error(`Timeline does not expose a native horizontal scrollbar: ${JSON.stringify(before)}`);
  }

  const scrollbarY = bounds.y + before.clientHeight
    + (before.offsetHeight - before.clientHeight) / 2;
  const thumbWidth = Math.max(24, before.clientWidth * before.clientWidth / before.scrollWidth);
  const thumbCenterX = bounds.x + thumbWidth / 2;
  const destinationX = Math.min(
    bounds.x + before.clientWidth - thumbWidth / 2 - 8,
    thumbCenterX + before.clientWidth * 0.45,
  );

  await page.mouse.move(thumbCenterX, scrollbarY);
  await page.mouse.down();
  await page.mouse.move(destinationX, scrollbarY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const after = await viewport.evaluate((element) => ({
    currentTime: document.querySelector('.timeline-panel__playhead span')?.textContent,
    scrollLeft: element.scrollLeft,
  }));
  if (after.scrollLeft <= before.scrollLeft || after.currentTime !== before.currentTime) {
    throw new Error(`Horizontal scroll changed Timeline time: ${JSON.stringify({ before, after })}`);
  }

  console.log(JSON.stringify({ before, after }, null, 2));
} finally {
  await browser.close();
}
