/* global process, console, document, window */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.setDefaultTimeout(5_000);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ createMenuBar }, { createDefaultMenuActions }, { createMenuIcon }] = await Promise.all([
      import('/src/menu/menubar.ts'),
      import('/src/menu/menu-actions.ts'),
      import('/src/menu/menu-icon.ts'),
    ]);
    const actions = createDefaultMenuActions();
    const executed = [];
    const menuBar = createMenuBar({ actions, runAction: (actionId) => executed.push(actionId) });
    const fallback = createMenuIcon('unmapped-command');
    fallback.id = 'fallback-menu-icon';
    document.querySelector('#app').replaceChildren(menuBar.element, fallback);
    window.__commandMenuIconsFixture = {
      actionLabels: actions.filter((action) => !action.separator).map((action) => action.label),
      executed,
    };
  });

  const triggers = page.locator('.menu-bar__trigger');
  if (await triggers.count() !== 4) throw new Error('Expected four toolbar menu triggers.');
  const triggerDetails = await triggers.evaluateAll((buttons) => buttons.map((button) => ({
    label: button.textContent,
    iconCount: button.querySelectorAll(':scope > .menu-icon').length,
  })));
  if (triggerDetails.some((entry) => entry.iconCount !== 0)) {
    throw new Error(`Menu-bar triggers must remain text-only: ${JSON.stringify(triggerDetails)}`);
  }
  for (const label of ['File', 'Edit', 'Timeline', 'Panels']) {
    await page.getByRole('button', { name: label, exact: true }).waitFor();
  }

  const expectedLabels = await page.evaluate(() => window.__commandMenuIconsFixture.actionLabels);
  const menuItems = page.locator('.menu-bar__item');
  const itemDetails = await menuItems.evaluateAll((buttons) => buttons.map((button) => ({
    label: button.querySelector('.menu-bar__item-label')?.textContent,
    iconFirst: button.firstElementChild?.classList.contains('menu-icon'),
    icon: button.querySelector(':scope > .menu-icon')?.getAttribute('data-menu-icon'),
    ariaHidden: button.querySelector(':scope > .menu-icon')?.getAttribute('aria-hidden'),
    focusable: button.querySelector(':scope > .menu-icon')?.getAttribute('focusable'),
  })));
  if (itemDetails.length !== expectedLabels.length
    || itemDetails.some((entry) => !entry.iconFirst || !entry.icon || entry.icon === 'command'
      || entry.ariaHidden !== 'true' || entry.focusable !== 'false')
    || itemDetails.map((entry) => entry.label).join('|') !== expectedLabels.join('|')) {
    throw new Error(`Main command icons changed menu content or accessibility: ${JSON.stringify(itemDetails)}`);
  }

  if (!await page.locator('.menu-bar__item:disabled', { hasText: 'Guardar' }).count()) {
    throw new Error('Menu icon rendering changed the disabled state.');
  }
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.menu-bar__item', { has: page.locator('.menu-bar__item-label', { hasText: /^Abrir$/ }) }).click();
  const executed = await page.evaluate(() => window.__commandMenuIconsFixture.executed);
  if (executed.join('|') !== 'open-database') throw new Error(`Menu command behavior changed: ${executed.join(', ')}`);

  const fallback = await page.locator('#fallback-menu-icon').evaluate((icon) => ({
    icon: icon.getAttribute('data-menu-icon'),
    path: icon.querySelector('path')?.getAttribute('d'),
  }));
  if (fallback.icon !== 'command' || !fallback.path) throw new Error(`Fallback icon is invalid: ${JSON.stringify(fallback)}`);

  console.log(JSON.stringify({ triggerDetails, itemCount: itemDetails.length, fallback, executed }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
