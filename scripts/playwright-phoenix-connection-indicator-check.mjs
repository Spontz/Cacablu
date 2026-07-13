/* global process, console, document, window, getComputedStyle */

import { chromium } from 'playwright';

const baseUrl = process.env.CACABLU_E2E_URL ?? 'http://127.0.0.1:5177/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 500 } });
await page.routeWebSocket(/127\.0\.0\.1:29100/, () => {});

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const [{ notifyPhoenixActivity }, indicator] = await Promise.all([
      import('/src/phoenix/activity.ts'),
      import('/src/app/phoenix-connection-indicator.ts'),
    ]);
    const badge = document.createElement('div');
    badge.className = 'connection-badge';
    document.body.append(badge);
    indicator.updatePhoenixConnectionIndicator(badge, 'Phoenix connected', 'connected');
    indicator.installPhoenixConnectionIndicator(badge);
    window.__indicatorFixture = { badge, notifyPhoenixActivity, indicator };
  });

  const readIndicator = () => page.evaluate(() => {
    const badge = window.__indicatorFixture.badge;
    const style = getComputedStyle(badge);
    const keyframes = badge.getAnimations()[0]?.effect?.getKeyframes() ?? [];
    return {
      status: badge.dataset.status,
      activity: badge.dataset.activity ?? null,
      boxShadow: style.boxShadow,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationTimingFunction: style.animationTimingFunction,
      beforeContent: getComputedStyle(badge, '::before').content,
      firstKeyframeShadow: keyframes[0]?.boxShadow ?? null,
      lastKeyframeShadow: keyframes.at(-1)?.boxShadow ?? null,
    };
  });

  const idle = await readIndicator();
  if (idle.animationName !== 'phoenix-connection-glow' || idle.animationDuration !== '3.2s' || idle.animationTimingFunction !== 'ease-out' || idle.boxShadow === 'none' || idle.beforeContent !== 'none') {
    throw new Error(`Connected idle indicator is invalid: ${JSON.stringify(idle)}`);
  }
  if (!idle.firstKeyframeShadow?.includes('rgba(89, 255, 191, 0.98)') || idle.firstKeyframeShadow === idle.lastKeyframeShadow) {
    throw new Error(`Idle pulse does not start bright and fade: ${JSON.stringify(idle)}`);
  }

  await page.evaluate(() => window.__indicatorFixture.notifyPhoenixActivity());
  const active = await readIndicator();
  if (active.activity !== 'active' || active.animationName !== 'phoenix-connection-activity-glow' || active.animationDuration !== '0.42s') {
    throw new Error(`Active indicator is invalid: ${JSON.stringify(active)}`);
  }

  await page.waitForTimeout(850);
  const settled = await readIndicator();
  if (settled.activity !== null || settled.animationDuration !== '3.2s') {
    throw new Error(`Indicator did not return to idle: ${JSON.stringify(settled)}`);
  }

  await page.evaluate(() => {
    const fixture = window.__indicatorFixture;
    fixture.indicator.updatePhoenixConnectionIndicator(fixture.badge, 'Phoenix disconnected', 'disconnected');
  });
  const disconnected = await readIndicator();
  if (disconnected.activity !== null || disconnected.animationName !== 'none') {
    throw new Error(`Disconnected indicator is invalid: ${JSON.stringify(disconnected)}`);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const fixture = window.__indicatorFixture;
    fixture.indicator.updatePhoenixConnectionIndicator(fixture.badge, 'Phoenix connected', 'connected');
    fixture.notifyPhoenixActivity();
  });
  const reducedMotion = await readIndicator();
  if (reducedMotion.animationName !== 'none' || reducedMotion.activity !== 'active' || reducedMotion.boxShadow === 'none') {
    throw new Error(`Reduced-motion indicator is invalid: ${JSON.stringify(reducedMotion)}`);
  }

  console.log(JSON.stringify({ idle, active, settled, disconnected, reducedMotion }, null, 2));
} finally {
  await browser.close();
}
