# WebSocket Shell Contract

## Purpose

Define the browser-side categories and expectations for messages that will flow
between the Cacablu application shell and the local visuals engine.

## Connection Expectations

- The application shell must load successfully when no connection exists.
- The shell may attempt a manual or automatic connection later without blocking
  the initial UI.
- Connection state must always be visible to the shell so menus and status UI
  can respond appropriately.

## Message Categories

### `status`

**Purpose**: Communicate transport or engine readiness information.

**Expected Payload Shape**:

```json
{
  "state": "connected | ready | busy | error",
  "message": "human readable status"
}
```

### `resource`

**Purpose**: Exchange resource inventory or metadata relevant to the workspace.

**Expected Payload Shape**:

```json
{
  "items": [],
  "source": "engine"
}
```

### `timeline`

**Purpose**: Exchange timeline positions, markers, or transport-related updates.

**Expected Payload Shape**:

```json
{
  "playhead": 0,
  "markers": [],
  "state": "stopped | playing | paused"
}
```

### `event`

**Purpose**: Carry generic engine-originated events that may be shown in the
events panel or forwarded to future features.

**Expected Payload Shape**:

```json
{
  "name": "event-name",
  "detail": {}
}
```

## Error Handling

- Unknown categories must not crash the shell.
- Invalid payloads should be ignored or surfaced as non-blocking errors.
- Connection loss must degrade to a visible disconnected or error state without
  destroying the current workspace layout.
