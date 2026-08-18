import type { IContentRenderer } from 'dockview-core';

import { LAST_COMMIT_AT } from '../build-info';
import { createContentRenderer } from './base-panel';

export const ABOUT_PANEL_TEXT = LAST_COMMIT_AT;

export function createAboutPanel(): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--about';

    const timestamp = document.createElement('time');
    timestamp.className = 'about-panel__timestamp';
    timestamp.textContent = ABOUT_PANEL_TEXT;

    element.replaceChildren(timestamp);
  });
}
