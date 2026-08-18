/* global process, console, document */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.setDefaultTimeout(10_000);

function assertPanelBelowMenu(bounds, phase) {
  const tolerance = 1;
  if (bounds.panelTop < bounds.menuBottom - tolerance
    || bounds.panelTop < bounds.workspaceTop - tolerance) {
    throw new Error(`Floating panel crossed under the menu ${phase}: ${JSON.stringify(bounds)}`);
  }
  if (bounds.closeTop < bounds.menuBottom - tolerance
    || bounds.closeBottom > bounds.workspaceBottom + tolerance) {
    throw new Error(`Floating panel close control became unreachable ${phase}: ${JSON.stringify(bounds)}`);
  }
}

async function readBounds() {
  return page.evaluate(() => {
    const menu = document.querySelector('.app-shell__topbar');
    const workspace = document.querySelector('.app-shell__workspace');
    const panel = document.querySelector('.dv-resize-container');
    const close = panel?.querySelector('.dv-default-tab-action');
    if (!menu || !workspace || !panel || !close) {
      throw new Error('Could not find menu, workspace, floating panel, and close control.');
    }

    const menuRect = menu.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    return {
      menuBottom: menuRect.bottom,
      workspaceTop: workspaceRect.top,
      workspaceBottom: workspaceRect.bottom,
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      closeTop: closeRect.top,
      closeBottom: closeRect.bottom,
    };
  });
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('.menu-bar__item-label', { hasText: /^Graphics$/ }).click();

  const floatingPanel = page.locator('.dv-resize-container');
  await floatingPanel.waitFor({ state: 'visible' });
  assertPanelBelowMenu(await readBounds(), 'when opened');

  const dragHandle = floatingPanel.locator('.dv-void-container');
  const handleBox = await dragHandle.boundingBox();
  if (!handleBox) throw new Error('Floating panel drag handle has no bounds.');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, -100, { steps: 10 });
  await page.mouse.up();
  assertPanelBelowMenu(await readBounds(), 'after upward drag');

  await page.setViewportSize({ width: 760, height: 480 });
  await page.waitForTimeout(100);
  const resizedBounds = await readBounds();
  assertPanelBelowMenu(resizedBounds, 'after viewport resize');

  await floatingPanel.locator('.dv-default-tab-action').click();
  if (await floatingPanel.count() !== 0) {
    throw new Error('Floating panel close control did not close the panel.');
  }

  console.log(JSON.stringify({ resizedBounds, closed: true }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
