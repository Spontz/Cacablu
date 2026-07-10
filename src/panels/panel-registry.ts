import type { IContentRenderer } from 'dockview-core';

import type { AppState } from '../state/app-state';
import type { DbState } from '../state/db-state';
import type { DbSessionRef } from '../db/db-session';
import type { ConnectionController } from '../ws/connection';
import type { UndoManager } from '../app/undo-manager';
import { createContentRenderer } from './base-panel';
import { createDbExplorerPanel } from './db-explorer-panel';
import { createEventsPanel } from './events-panel';
import { createInspectorPanel } from './inspector-panel';
import { createPreviewPanel } from './preview-panel';
import { createResourcesPanel } from './resources-panel';
import { createSectionEditorPanel } from './section-editor-panel';
import { createTimelinePanel } from './timeline-panel';
import { createGraphicsSettingsPanel } from './graphics-settings-dialog';
import { createGlslAssetEditorPanel } from './glsl-asset-editor-panel';
import { createDemoSettingsPanel } from './demo-settings-dialog';
import { createMarkersPanel } from './markers-panel';

export interface PanelRegistry {
  create(name: string): IContentRenderer;
}

export function createPanelRegistry(
  state: AppState,
  dbState: DbState,
  sessionRef: DbSessionRef,
  connection: ConnectionController,
  undoManager: UndoManager,
): PanelRegistry {
  return {
    create(name: string): IContentRenderer {
      switch (name) {
        case 'resources-panel':
          return createResourcesPanel(state, dbState, sessionRef, connection);
        case 'timeline-panel':
          return createTimelinePanel(state, dbState, sessionRef, connection, undoManager);
        case 'preview-panel':
          return createPreviewPanel(connection);
        case 'inspector-panel':
          return createInspectorPanel(state, dbState, sessionRef);
        case 'section-editor-panel':
          return createSectionEditorPanel(state, dbState, sessionRef, connection, undoManager);
        case 'events-panel':
          return createEventsPanel(state);
        case 'db-explorer-panel':
          return createDbExplorerPanel(dbState, sessionRef);
        case 'graphics-settings-panel':
          return createGraphicsSettingsPanel(state, dbState, sessionRef);
        case 'demo-settings-panel':
          return createDemoSettingsPanel(state, dbState, sessionRef);
        case 'markers-panel':
          return createMarkersPanel(dbState, sessionRef, undoManager);
        case 'glsl-asset-editor-panel':
          return createGlslAssetEditorPanel(state, dbState, sessionRef, connection);
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
