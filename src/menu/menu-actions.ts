import type { MenuActionDefinition } from '../app/types';

export function createDefaultMenuActions(): MenuActionDefinition[] {
  return [
    { id: 'noop-new-project', label: 'New Project', menu: 'File' },
    { id: 'noop-open-project', label: 'Open Project', menu: 'File' },
    { id: 'reset-layout', label: 'Reset Layout', menu: 'View' },
    { id: 'toggle-resources', label: 'Focus Resources', menu: 'Window' },
    { id: 'toggle-timeline', label: 'Focus Timeline', menu: 'Window' },
    { id: 'toggle-preview', label: 'Focus Preview', menu: 'Window' },
    { id: 'toggle-inspector', label: 'Focus Inspector', menu: 'Window' },
    { id: 'toggle-events', label: 'Focus Events', menu: 'Window' },
    { id: 'connection-status', label: 'Cycle Connection State', menu: 'Help' },
    { id: 'about-shell', label: 'About Shell', menu: 'Help' },
  ];
}
