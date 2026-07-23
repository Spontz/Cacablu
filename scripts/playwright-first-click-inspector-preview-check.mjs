/* global process, console, window, File, fetch, document, MutationObserver, HTMLElement, HTMLImageElement, Event */

import { access } from 'node:fs/promises';
import { chromium } from 'playwright';

const projectPath = process.env.CACABLU_PROJECT_PATH;
const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5173/';
const assetName = process.env.CACABLU_PREVIEW_ASSET ?? 'loadingback.jpg';
const folderIds = (process.env.CACABLU_PREVIEW_FOLDER_IDS ?? '').split(',').filter(Boolean);

if (!projectPath) throw new Error('Set CACABLU_PROJECT_PATH to a Cacablu SQLite project.');
await access(projectPath);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(120_000);

try {
  await page.routeWebSocket('ws://127.0.0.1:29100/ws', (socket) => socket.close());
  await page.route('**/__preview_project.sqlite', (route) => route.fulfill({
    path: projectPath,
    contentType: 'application/x-sqlite3',
  }));
  await page.addInitScript(() => {
    const handle = {
      kind: 'file',
      name: 'preview-project.sqlite',
      getFile: async () => new File(
        [await (await fetch('/__preview_project.sqlite')).arrayBuffer()],
        'preview-project.sqlite',
        { type: 'application/x-sqlite3' },
      ),
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
      isSameEntry: async () => true,
    };
    window.showOpenFilePicker = async () => [handle];
    window.showSaveFilePicker = async () => handle;
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.keyboard.press('Control+O');
  for (const folderId of folderIds) {
    await page.locator(`[data-resource-kind="folder"][data-resource-id="${folderId}"]`).click();
  }
  const asset = page.locator(`[data-resource-kind="file"][data-resource-name="${assetName}"]`).first();
  await asset.waitFor({ state: 'visible' });
  await page.evaluate(() => {
    window.__inspectorImages = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('.inspector__image')) window.__inspectorImages.push(node);
          window.__inspectorImages.push(...node.querySelectorAll('.inspector__image'));
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__inspectorObserver = observer;
  });
  await asset.click();
  await page.waitForFunction((name) => {
    const selected = document.querySelector(`[data-resource-kind="file"][data-resource-name="${name}"].is-selected`);
    const displayedName = [...document.querySelectorAll('.inspector__meta-value')]
      .some((element) => element.textContent === name);
    const image = document.querySelector('.inspector__image');
    const model = document.querySelector('.inspector__model-frame canvas');
    return Boolean(selected && displayedName && ((image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0) || model));
  }, assetName);

  const staleCallbackCheck = await page.evaluate(() => {
    const captured = window.__inspectorImages ?? [];
    const stale = captured.filter((image) => !image.isConnected);
    for (const image of stale) image.dispatchEvent(new Event('error'));
    window.__inspectorObserver?.disconnect();
    return {
      captured: captured.length,
      stale: stale.length,
      currentImage: Boolean(document.querySelector('.inspector__image')),
      currentNote: document.querySelector('.inspector__note')?.textContent ?? null,
    };
  });
  if (staleCallbackCheck.stale > 0 && !staleCallbackCheck.currentImage) {
    throw new Error(`A stale image callback replaced the first-click preview: ${JSON.stringify(staleCallbackCheck)}`);
  }

  const result = await page.evaluate((name) => ({
    name,
    selected: Boolean(document.querySelector(`[data-resource-kind="file"][data-resource-name="${name}"].is-selected`)),
    inspectorValues: [...document.querySelectorAll('.inspector__meta-value')].map((element) => element.textContent),
    note: document.querySelector('.inspector__note')?.textContent ?? null,
    image: Boolean(document.querySelector('.inspector__image')),
    model: Boolean(document.querySelector('.inspector__model-frame canvas')),
  }), assetName);
  console.log(JSON.stringify({ ...result, staleCallbackCheck }, null, 2));
} finally {
  await browser.close();
}
