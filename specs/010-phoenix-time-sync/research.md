# Research: Phoenix Time Sync

## Decision: Use Native Browser WebSocket

**Decision**: Cacablu will use the browser's built-in `WebSocket` API to connect directly to Phoenix.

**Rationale**: The application must remain static and backend-free. Browser-native WebSocket is sufficient for persistent bidirectional runtime messages and avoids a runtime dependency.

**Alternatives considered**:

- Backend bridge: rejected because the requested direction is direct browser-to-Phoenix connection.
- WebSocket client library: rejected for the first slice because it adds little value over native APIs.

## Decision: Runtime State Is Authoritative From Phoenix

**Decision**: When connected, Cacablu's timeline transport time and playing state mirror Phoenix `runtime.state` messages.

**Rationale**: Phoenix is the renderer/player, so the timeline playhead should reflect the actual engine runtime instead of a local simulation.

**Alternatives considered**:

- Continue local animation and periodically reconcile: rejected because it can drift and show misleading time.

## Decision: Use Simple Runtime Commands

**Decision**: The five transport buttons map to `runtime.seek`, `runtime.play`, and `runtime.pause`.

**Rationale**: Phoenix already has time setters and play/pause behavior, and this keeps the first integration minimal.

**Alternatives considered**:

- Add dedicated `runtime.start`, `runtime.rewind`, `runtime.forward`, and `runtime.end` messages immediately: rejected because those can be expressed as seek/play/pause for the first implementation.

## Decision: Fixed Rewind/Forward Delta

**Decision**: Rewind and Forward use a fixed one-second delta in the first implementation.

**Rationale**: Phoenix frame-step semantics are not part of this slice yet. One second is visible, easy to validate, and can later become configurable or frame-based.

**Alternatives considered**:

- Use one frame: rejected until Phoenix exposes or agrees on a frame duration/step command.
- Use timeline grid step: rejected because grid and engine time may diverge.

## Decision: Preserve Existing Export Flow

**Decision**: Live Phoenix transport control does not replace the existing SQLite-to-engine-data export workflow in this slice.

**Rationale**: The user requested time sync and five buttons first. Data export, section editing, and asset sync are separate surfaces.
