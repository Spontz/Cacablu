import type { MenuActionDefinition } from '../app/types';

export function createDefaultMenuActions(): MenuActionDefinition[] {
  return [
    { id: 'open-database', label: 'Abrir', menu: 'File' },
    { id: 'save-database', label: 'Guardar', menu: 'File', disabled: true },
    { id: 'save-database-as', label: 'Guardar como', menu: 'File', disabled: true },
    { id: 'reset-layout', label: 'Reset Layout', menu: 'View' },
    { id: 'toggle-db-explorer', label: 'Database Explorer', menu: 'Window' },
    { id: 'toggle-resources', label: 'Pool', menu: 'Window' },
    { id: 'toggle-timeline', label: 'Timeline', menu: 'Window' },
    { id: 'toggle-preview', label: 'Preview', menu: 'Window' },
    { id: 'toggle-inspector', label: 'Inspector', menu: 'Window' },
    { id: 'toggle-events', label: 'Events', menu: 'Window' },
    { id: 'connection-status', label: 'Cycle Connection State', menu: 'Help' },
    { id: 'about-shell', label: 'About Shell', menu: 'Help' },
  ];
}
