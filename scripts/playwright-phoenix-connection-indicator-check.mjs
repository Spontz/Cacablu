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
    const glowStyle = getComputedStyle(badge, '::after');
    const glowAnimation = badge.getAnimations({ subtree: true })
      .find((animation) => animation.animationName?.startsWith('phoenix-connection'));
    const keyframes = glowAnimation?.effect?.getKeyframes() ?? [];
    return {
      status: badge.dataset.status,
      activity: badge.dataset.activity ?? null,
      boxShadow: style.boxShadow,
      animationName: glowStyle.animationName,
      animationDuration: glowStyle.animationDuration,
      animationTimingFunction: glowStyle.animationTimingFunction,
      beforeContent: getComputedStyle(badge, '::before').content,
      afterContent: glowStyle.content,
      firstKeyframeOpacity: keyframes[0]?.opacity ?? null,
      lastKeyframeOpacity: keyframes.at(-1)?.opacity ?? null,
    };
  });

  const idle = await readIndicator();
  if (idle.animationName !== 'phoenix-connection-glow' || idle.animationDuration !== '3.2s' || idle.animationTimingFunction !== 'ease-out' || idle.boxShadow === 'none' || idle.beforeContent !== 'none' || idle.afterContent !== '""') {
    throw new Error(`Connected idle indicator is invalid: ${JSON.stringify(idle)}`);
  }
  if (idle.firstKeyframeOpacity !== '1' || idle.lastKeyframeOpacity !== '0') {
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

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const syncModal = await page.evaluate(() => {
    const overlay = document.querySelector('.pool-sync-modal');
    const indicator = overlay?.querySelector('.pool-sync-indicator');
    const fill = overlay?.querySelector('.pool-sync-indicator__progress-fill');
    if (!(overlay instanceof HTMLElement) || !(indicator instanceof HTMLElement) || !(fill instanceof HTMLElement)) {
      return null;
    }
    overlay.hidden = false;
    indicator.dataset.mode = 'indeterminate';
    const overlayStyle = getComputedStyle(overlay);
    const animation = fill.getAnimations()[0];
    const keyframes = animation?.effect?.getKeyframes() ?? [];
    const result = {
      backdropFilter: overlayStyle.backdropFilter,
      animationName: getComputedStyle(fill).animationName,
      firstTransform: keyframes[0]?.transform ?? null,
      lastTransform: keyframes.at(-1)?.transform ?? null,
      firstLeft: keyframes[0]?.left ?? null,
      lastLeft: keyframes.at(-1)?.left ?? null,
    };
    overlay.hidden = true;
    return result;
  });
  if (!syncModal || syncModal.backdropFilter !== 'none' || syncModal.animationName !== 'pool-sync-indeterminate' || syncModal.firstTransform === syncModal.lastTransform || syncModal.firstLeft !== null || syncModal.lastLeft !== null) {
    throw new Error(`Phoenix sync modal uses a repaint-heavy animation: ${JSON.stringify(syncModal)}`);
  }

  console.log(JSON.stringify({ idle, active, settled, disconnected, reducedMotion, syncModal }, null, 2));
} finally {
  await browser.close();
}
