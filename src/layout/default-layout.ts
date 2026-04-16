import type { PanelDefinition } from '../app/types';

export const DEFAULT_PANELS: PanelDefinition[] = [
  {
    id: 'resources',
    title: 'Resources',
    component: 'resources-panel',
    description: 'Media, assets, and imported material.',
  },
  {
    id: 'timeline',
    title: 'Timeline',
    component: 'timeline-panel',
    description: 'Time-based sequencing and transport state.',
  },
  {
    id: 'preview',
    title: 'Preview',
    component: 'preview-panel',
    description: 'Main preview area for visuals and transport feedback.',
  },
  {
    id: 'inspector',
    title: 'Inspector',
    component: 'inspector-panel',
    description: 'Focused details and controls for the current selection.',
  },
  {
    id: 'events',
    title: 'Events',
    component: 'events-panel',
    description: 'Connection and engine events emitted by the shell.',
  },
  {
    id: 'db-explorer',
    title: 'Database Explorer',
    component: 'db-explorer-panel',
    description: 'Browse tables and rows of the loaded SQLite database.',
  },
];
