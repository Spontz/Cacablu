import { subscribePhoenixActivity } from '../phoenix/activity';

const ACTIVITY_WINDOW_MS = 750;

export function installPhoenixConnectionIndicator(badge: HTMLElement): () => void {
  let activityTimer: number | null = null;

  const clearActivity = (): void => {
    if (activityTimer !== null) window.clearTimeout(activityTimer);
    activityTimer = null;
    delete badge.dataset.activity;
  };
  const unsubscribe = subscribePhoenixActivity(() => {
    if (badge.dataset.status !== 'connected') {
      clearActivity();
      return;
    }
    badge.dataset.activity = 'active';
    if (activityTimer !== null) window.clearTimeout(activityTimer);
    activityTimer = window.setTimeout(clearActivity, ACTIVITY_WINDOW_MS);
  });

  return () => {
    unsubscribe();
    clearActivity();
  };
}

export function updatePhoenixConnectionIndicator(
  badge: HTMLElement,
  label: string,
  status: string,
): void {
  badge.dataset.status = status;
  badge.textContent = label;
  if (status !== 'connected') delete badge.dataset.activity;
}
