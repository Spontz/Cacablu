/* global process, console, window, File, fetch, document */

import { access } from 'node:fs/promises';
import { chromium } from 'playwright';

const projectPath = process.env.CACABLU_PROJECT_PATH;
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5191/';

if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a real Cacablu SQLite project.');
await access(projectPath);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(120_000);

const alerts = [];
const pageErrors = [];
page.on('dialog', async (dialog) => {
  alerts.push(dialog.message());
  await dialog.dismiss();
});
page.on('pageerror', (error) => pageErrors.push(error.message));

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
  const firstFile = page.locator('[data-resource-kind="file"]').first();
  await firstFile.waitFor({ state: 'visible' });
  const firstSource = await firstFile.evaluate((element) => ({
    id: element.getAttribute('data-resource-id'),
    name: element.getAttribute('data-resource-name'),
    path: element.getAttribute('data-pool-path'),
  }));

  await firstFile.click();
  const preview = page.locator('.inspector__image');
  await preview.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const image = document.querySelector('.inspector__image');
    return image?.tagName === 'IMG' && image.complete && image.naturalWidth > 0;
  });

  const secondFile = page.locator('[data-resource-kind="file"]').nth(1);
  const source = await secondFile.evaluate((element) => ({
    id: element.getAttribute('data-resource-id'),
    name: element.getAttribute('data-resource-name'),
    path: element.getAttribute('data-pool-path'),
  }));
  await secondFile.click();
  await page.waitForTimeout(250);
  const selectionAfterOneClick = await page.evaluate(() => ({
    selectedIds: [...document.querySelectorAll('[data-resource-kind].is-selected')]
      .map((element) => element.getAttribute('data-resource-id')),
    previewVisible: Boolean(document.querySelector('.inspector__image')?.getBoundingClientRect().width),
  }));
  if (!selectionAfterOneClick.selectedIds.includes(source.id)) {
    throw new Error(`A Pool item was not selected by its first click: ${JSON.stringify({ firstSource, source, selectionAfterOneClick, alerts, pageErrors })}`);
  }
  await page.waitForFunction((fileName) => {
    const values = [...document.querySelectorAll('.inspector__meta-value')];
    const image = document.querySelector('.inspector__image');
    return values.some((element) => element.textContent === fileName)
      && image?.tagName === 'IMG'
      && image.complete
      && image.naturalWidth > 0;
  }, source.name);
  await page.keyboard.press('Control+X');
  await page.waitForTimeout(250);

  const result = await page.evaluate((sourceId) => {
    const element = [...document.querySelectorAll('[data-resource-kind="file"]')]
      .find((candidate) => candidate.getAttribute('data-resource-id') === sourceId);
    return {
    className: element?.className ?? null,
    opacity: element ? window.getComputedStyle(element).opacity : null,
    activeElement: document.activeElement?.className ?? document.activeElement?.tagName ?? null,
    activeTabs: [...document.querySelectorAll('.dv-active-tab')].map((tab) => tab.textContent?.trim()),
    previewVisible: Boolean(document.querySelector('.inspector__image')?.getBoundingClientRect().width),
    selectedIds: [...document.querySelectorAll('[data-resource-kind].is-selected')]
      .map((element) => element.getAttribute('data-resource-id')),
    cutIds: [...document.querySelectorAll('[data-resource-kind].is-cut-pending')]
      .map((element) => element.getAttribute('data-resource-id')),
    inspectorValues: [...document.querySelectorAll('.inspector__meta-value')].map((element) => element.textContent),
  };
  }, source.id);
  if (!result.previewVisible || !result.className?.includes('is-cut-pending') || result.opacity !== '0.5') {
    throw new Error(`Real-project Ctrl+X was not captured: ${JSON.stringify({ source, result, alerts, pageErrors })}`);
  }

  console.log(JSON.stringify({ firstSource, source, selectionAfterOneClick, result, alerts, pageErrors }, null, 2));
} finally {
  await browser.close();
}
