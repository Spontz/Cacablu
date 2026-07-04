import type { MenuActionDefinition } from '../app/types';

export function createDefaultMenuActions(): MenuActionDefinition[] {
  return [
    { id: 'open-database', label: 'Abrir', menu: 'File' },
    { id: 'save-database', label: 'Guardar', menu: 'File', disabled: true },
    { id: 'save-database-as', label: 'Guardar como', menu: 'File', disabled: true },
    { id: 'edit-undo', label: 'Undo', menu: 'Edit', shortcut: { default: 'Ctrl+Z', mac: '⌘Z' } },
    { id: 'edit-separator-clipboard', label: '', menu: 'Edit', separator: true },
    { id: 'edit-cut', label: 'Cut', menu: 'Edit' },
    { id: 'edit-copy', label: 'Copy', menu: 'Edit' },
    { id: 'edit-paste', label: 'Paste', menu: 'Edit' },
    { id: 'edit-delete', label: 'Delete', menu: 'Edit', shortcut: { default: 'Del' } },
    { id: 'edit-separator-graphics', label: '', menu: 'Edit', separator: true },
    { id: 'edit-graphics', label: 'Graphics', menu: 'Edit' },
    { id: 'toggle-display-timeline-ids', label: 'Display IDs', menu: 'Bars' },
    { id: 'bars-separator-selection', label: '', menu: 'Bars', separator: true },
    { id: 'select-all-bars', label: 'Select All', menu: 'Bars', shortcut: { default: 'Ctrl+A', mac: '⌘A' } },
    { id: 'reset-layout', label: 'Close all panels', menu: 'Panels' },
    { id: 'panels-separator-close', label: '', menu: 'Panels', separator: true },
    { id: 'toggle-db-explorer', label: 'Database Explorer', menu: 'Panels' },
    { id: 'toggle-resources', label: 'Pool', menu: 'Panels' },
    { id: 'toggle-timeline', label: 'Timeline', menu: 'Panels' },
    { id: 'toggle-preview', label: 'Preview', menu: 'Panels' },
    { id: 'toggle-inspector', label: 'Inspector', menu: 'Panels' },
    { id: 'toggle-section-editor', label: 'Bar Editor', menu: 'Panels' },
    { id: 'toggle-events', label: 'Events', menu: 'Panels' },
  ];
}
