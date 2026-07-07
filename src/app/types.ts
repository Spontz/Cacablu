export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type EngineMessageType = 'status' | 'resource' | 'timeline' | 'event';

export type ResourceSelection =
  | { kind: 'none' }
  | { kind: 'folder'; id: number; name: string }
  | { kind: 'file'; id: number; name: string; fileType: string }
  | { kind: 'bar'; id: number }
  | { kind: 'bars'; ids: number[] };

export type AppEventSeverity = 'info' | 'warning' | 'error';

export interface AppEvent {
  id: string;
  timestamp: number;
  severity: AppEventSeverity;
  description: string;
  source?: string;
  subjectId?: string;
}

export interface PanelDefinition {
  id: string;
  title: string;
  component: string;
  description: string;
}

export interface MenuActionDefinition {
  id: string;
  label: string;
  menu: 'File' | 'Edit' | 'Bars' | 'Panels';
  disabled?: boolean;
  separator?: boolean;
  shortcut?: {
    default: string;
    mac?: string;
  };
}

export interface AppSnapshot {
  activePanelId: string | null;
  connectionStatus: ConnectionStatus;
  connectionLabel: string;
  lastError: string | null;
  resourceSelection: ResourceSelection;
  events: AppEvent[];
  unreadEventCount: number;
  displayTimelineIds: boolean;
  sectionErrorIds: number[];
}
