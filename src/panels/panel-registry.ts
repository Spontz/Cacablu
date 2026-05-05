import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import { createContentRenderer } from './base-panel';
import { createDbExplorerPanel } from './db-explorer-panel';
import { createEventsPanel } from './events-panel';
import { createInspectorPanel } from './inspector-panel';
import { createPreviewPanel } from './preview-panel';
import { createResourcesPanel } from './resources-panel';
import { createTimelinePanel } from './timeline-panel';

export interface PanelRegistry {
  create(name: string): IContentRenderer;
}

export function createPanelRegistry(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
): PanelRegistry {
  return {
    create(name: string): IContentRenderer {
      switch (name) {
        case 'resources-panel':
          return createResourcesPanel(state, dbState, sessionRef);
        case 'timeline-panel':
          return createTimelinePanel(dbState, sessionRef);
        case 'preview-panel':
          return createPreviewPanel(state);
        case 'inspector-panel':
          return createInspectorPanel(state, dbState, sessionRef);
        case 'events-panel':
          return createEventsPanel(state);
        case 'db-explorer-panel':
          return createDbExplorerPanel(dbState, sessionRef);
        default:
          return createFallbackPanel(name);
      }
    },
  };
}

function createFallbackPanel(name: string): IContentRenderer {
  return createContentRenderer((element) => {
    element.className = 'panel panel--placeholder';
    element.innerHTML = `<h2>${name}</h2><p>No panel factory is registered for this component yet.</p>`;
  });
}
