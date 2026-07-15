const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ICON_PATHS: Record<string, string> = {
  command: 'M6 7h12M6 12h12M6 17h12',
  folder: 'M3 7h7l2 2h9v10H3z',
  'folder-open': 'M3 8h7l2 2h9l-2 9H3z M3 8V5h7l2 3',
  'folder-plus': 'M3 7h7l2 2h9v10H3z M12 13v4M10 15h4',
  edit: 'M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20z M13.5 6.5l3.5 3.5',
  timeline: 'M4 6v12M4 9h6v4H4M10 12h6v4h-6M16 7h4v4h-4',
  panels: 'M4 4h16v16H4z M10 4v16M10 11h10',
  save: 'M5 4h12l2 2v14H5z M8 4v6h8V4M8 16h8',
  'save-as': 'M4 4h11l2 2v7M7 4v6h7V4M7 16h5 M14 19l5-5 2 2-5 5-3 1z',
  undo: 'M9 7l-5 5 5 5M5 12h8a6 6 0 0 1 6 6',
  cut: 'M8 8l10 10M18 6L8 16M6.5 9A2.5 2.5 0 1 0 6.5 4a2.5 2.5 0 0 0 0 5zM6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  copy: 'M8 8h11v12H8z M5 16H4V4h11v1',
  paste: 'M8 5h8v3H8z M6 7H4v13h14V7h-2',
  delete: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  graphics: 'M4 5h16v11H4z M9 20h6M12 16v4',
  settings: 'M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5M14 5v4M6 10v4M11 15v4',
  hash: 'M9 4L7 20M17 4l-2 16M4 9h16M3 15h16',
  toggle: 'M12 3v8M7 6a8 8 0 1 0 10 0',
  'select-all': 'M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3M8 12l3 3 5-6',
  'close-panels': 'M4 4h16v16H4z M9 9l6 6M15 9l-6 6',
  database: 'M5 6c0-3 14-3 14 0s-14 3-14 0z M5 6v6c0 3 14 3 14 0V6M5 12v6c0 3 14 3 14 0v-6',
  preview: 'M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  inspector: 'M4 4h16v16H4z M4 9h16M9 9v11M13 13h4M13 17h3',
  'bar-editor': 'M5 5h14v14H5z M10 9l-2 3 2 3M14 9l2 3-2 3',
  marker: 'M6 3v18M7 5h11l-3 4 3 4H7',
  events: 'M5 4h14v16H5z M8 8h8M8 12h8M8 16h5',
  rename: 'M4 18h5l10-10-4-4L5 14z M13 6l4 4',
};

const COMMAND_ICONS: Record<string, string> = {
  'open-database': 'folder-open',
  'save-database': 'save',
  'save-database-as': 'save-as',
  'edit-undo': 'undo',
  'edit-cut': 'cut',
  'edit-copy': 'copy',
  'edit-paste': 'paste',
  'edit-delete': 'delete',
  'edit-graphics': 'graphics',
  'edit-demo-settings': 'settings',
  'toggle-display-timeline-ids': 'hash',
  'toggle-enable-bars': 'toggle',
  'select-all-bars': 'select-all',
  'reset-layout': 'close-panels',
  'toggle-db-explorer': 'database',
  'toggle-resources': 'folder',
  'toggle-timeline': 'timeline',
  'toggle-preview': 'preview',
  'toggle-inspector': 'inspector',
  'toggle-section-editor': 'bar-editor',
  'toggle-markers': 'marker',
  'toggle-events': 'events',
  'new-folder': 'folder-plus',
  cut: 'cut',
  copy: 'copy',
  paste: 'paste',
  rename: 'rename',
  delete: 'delete',
};

export function createMenuIcon(commandId: string): SVGSVGElement {
  const requestedName = COMMAND_ICONS[commandId] ?? commandId;
  const iconName = ICON_PATHS[requestedName] ? requestedName : 'command';
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  icon.classList.add('menu-icon');
  icon.dataset.menuIcon = iconName;
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');

  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', ICON_PATHS[iconName]);
  icon.append(path);
  return icon;
}
