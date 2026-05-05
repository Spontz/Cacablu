export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type EngineMessageType = 'status' | 'resource' | 'timeline' | 'event';

export type ResourceSelection =
  | { kind: 'none' }
  | { kind: 'folder'; id: number; name: string }
  | { kind: 'file'; id: number; name: string; fileType: string };

export interface PanelDefinition {
  id: string;
  title: string;
  component: string;
  description: string;
}

export interface MenuActionDefinition {
  id: string;
  label: string;
  menu: 'File' | 'View' | 'Window' | 'Help';
  disabled?: boolean;
}

export interface AppSnapshot {
  activePanelId: string | null;
  connectionStatus: ConnectionStatus;
  connectionLabel: string;
  lastError: string | null;
  resourceSelection: ResourceSelection;
}
