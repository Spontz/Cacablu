import type { MenuActionDefinition } from '../app/types';

export function createDefaultMenuActions(): MenuActionDefinition[] {
  return [
    { id: 'open-database', label: 'Abrir', menu: 'File', shortcut: { default: 'Ctrl+O', mac: 'Cmd+O' } },
    { id: 'save-database', label: 'Guardar', menu: 'File', disabled: true, shortcut: { default: 'Ctrl+S', mac: 'Cmd+S' } },
    { id: 'save-database-as', label: 'Guardar como', menu: 'File', disabled: true, shortcut: { default: 'Ctrl+Shift+S', mac: 'Cmd+Shift+S' } },
    { id: 'edit-undo', label: 'Undo', menu: 'Edit', shortcut: { default: 'Ctrl+Z', mac: '⌘Z' } },
    { id: 'edit-separator-clipboard', label: '', menu: 'Edit', separator: true },
    { id: 'edit-cut', label: 'Cut', menu: 'Edit', shortcut: { default: 'Ctrl+X', mac: 'Cmd+X' } },
    { id: 'edit-copy', label: 'Copy', menu: 'Edit', shortcut: { default: 'Ctrl+C', mac: 'Cmd+C' } },
    { id: 'edit-paste', label: 'Paste', menu: 'Edit', shortcut: { default: 'Ctrl+V', mac: 'Cmd+V' } },
    { id: 'edit-delete', label: 'Delete', menu: 'Edit', shortcut: { default: 'Del' } },
    { id: 'edit-separator-graphics', label: '', menu: 'Edit', separator: true },
    { id: 'edit-graphics', label: 'Graphics', menu: 'Edit' },
    { id: 'edit-demo-settings', label: 'Demo Settings', menu: 'Edit' },
    { id: 'new-timeline-layer', label: 'New Layer', menu: 'Timeline', shortcut: { default: 'Ctrl+L' } },
    { id: 'toggle-display-timeline-ids', label: 'Display IDs', menu: 'Timeline' },
    { id: 'bars-separator-selection', label: '', menu: 'Timeline', separator: true },
    { id: 'toggle-enable-bars', label: 'Toggle Enable', menu: 'Timeline', shortcut: { default: 'Ctrl+D', mac: '⌘D' } },
    { id: 'select-all-bars', label: 'Select All', menu: 'Timeline', shortcut: { default: 'Ctrl+A', mac: '⌘A' } },
    { id: 'reset-layout', label: 'Close all panels', menu: 'Panels' },
    { id: 'panels-separator-close', label: '', menu: 'Panels', separator: true },
    { id: 'toggle-db-explorer', label: 'Database Explorer', menu: 'Panels' },
    { id: 'toggle-resources', label: 'Pool', menu: 'Panels' },
    { id: 'toggle-timeline', label: 'Timeline', menu: 'Panels' },
    { id: 'toggle-preview', label: 'Preview', menu: 'Panels' },
    { id: 'toggle-inspector', label: 'Inspector', menu: 'Panels' },
    { id: 'toggle-section-editor', label: 'Bar Editor', menu: 'Panels' },
    { id: 'toggle-markers', label: 'Markers', menu: 'Panels' },
    { id: 'toggle-events', label: 'Events', menu: 'Panels' },
  ];
}
