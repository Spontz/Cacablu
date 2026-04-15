# Data Model: Application Shell Layout

## WorkspaceLayout

**Purpose**: Represents the default or current arrangement of panels in the main workspace.

**Fields**:
- `activePanelId`: string | null
- `panelIds`: string[]
- `canReset`: boolean

**Validation Rules**:
- Panel identifiers must be unique.
- The layout must always contain the preview panel.

## PanelDefinition

**Purpose**: Declares a workspace panel that can be created by the shell.

**Fields**:
- `id`: string
- `title`: string
- `component`: string
- `defaultVisible`: boolean
- `description`: string

**Validation Rules**:
- `id` must remain stable across layout resets.
- `component` must map to a known panel factory.

## MenuAction

**Purpose**: Represents a command exposed in the top menu bar.

**Fields**:
- `id`: string
- `label`: string
- `menu`: string
- `enabled`: boolean

**Validation Rules**:
- Action IDs must be unique.
- Actions in the Window or View menu must be reversible or repeatable safely.

## ConnectionState

**Purpose**: Captures the browser-side connection status to the local visuals engine.

**Fields**:
- `status`: `disconnected | connecting | connected | error`
- `url`: string | null
- `lastError`: string | null

**Validation Rules**:
- `error` requires `lastError` to be present.
- `connected` implies a resolved URL is known.

## EngineMessageEnvelope

**Purpose**: Normalized browser-side representation of shell-relevant engine traffic.

**Fields**:
- `type`: `resource | timeline | event | status`
- `timestamp`: number
- `payload`: unknown

**Validation Rules**:
- `type` must be one of the known categories.
- `timestamp` must be numeric.
