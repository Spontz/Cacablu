import { describe, expect, it } from 'vitest';

import { LAST_COMMIT_AT, LAST_COMMIT_TIMESTAMP_PATTERN } from '../../src/build-info';
import { DEFAULT_PANELS } from '../../src/layout/default-layout';
import { createDefaultMenuActions } from '../../src/menu/menu-actions';
import { ABOUT_PANEL_TEXT } from '../../src/panels/about-panel';

describe('About panel', () => {
  it('exposes the embedded latest-commit timestamp in the required format', () => {
    expect(LAST_COMMIT_AT).toMatch(LAST_COMMIT_TIMESTAMP_PATTERN);
    expect(ABOUT_PANEL_TEXT).toBe(LAST_COMMIT_AT);
  });

  it('is registered as one panel and one Panels menu action', () => {
    expect(DEFAULT_PANELS.filter((panel) => panel.id === 'about')).toEqual([{
      id: 'about',
      title: 'About',
      component: 'about-panel',
      description: 'Build revision information.',
    }]);
    expect(createDefaultMenuActions().filter((action) => action.id === 'toggle-about')).toEqual([{
      id: 'toggle-about',
      label: 'About',
      menu: 'Panels',
    }]);
  });
});
