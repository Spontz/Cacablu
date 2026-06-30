# Data Model: Phoenix Time Sync

## PhoenixConnectionState

Represents the current WebSocket lifecycle from Cacablu's perspective.

Fields:

- `status`: `disconnected | connecting | connected | error`
- `label`: user-visible short status
- `error`: optional diagnostic message
- `lastConnectedAt`: timestamp when a connection was last opened
- `lastDisconnectedAt`: timestamp when a connection last closed

Validation:

- `error` is present only when `status` is `error` or when the previous close reason is useful.
- UI must tolerate all statuses.

## PhoenixRuntimeState

Latest runtime state received from Phoenix.

Fields:

- `time`: current Phoenix demo time in seconds
- `playing`: whether Phoenix is currently playing
- `fps`: optional current FPS
- `startTime`: optional Phoenix demo start time
- `endTime`: optional Phoenix demo end time
- `receivedAt`: local timestamp when the message was accepted

Validation:

- `time` must be finite and clamped to zero or greater before applying to the timeline.
- `endTime` updates local duration only when finite and greater than zero.
- Missing optional fields must not invalidate the whole runtime state.

## PhoenixTransportCommand

User command sent from a Cacablu transport button to Phoenix.

Variants:

- `runtime.play`
- `runtime.pause`
- `runtime.seek` with `time`

Button mapping:

- Go to Beginning -> `runtime.seek` time `0`
- Rewind -> `runtime.seek` current time minus one second, clamped to `0`
- Play/Pause -> `runtime.play` or `runtime.pause` based on latest `playing`
- Forward -> `runtime.seek` current time plus one second, clamped to duration when known
- Go to End -> `runtime.seek` end time or local duration

Validation:

- Commands are sent only while WebSocket status is `connected`.
- Seek times must be finite and zero or greater.

## TimelineTransportProjection

The timeline state derived from Phoenix runtime state.

Fields:

- `currentTime`: mirrors `PhoenixRuntimeState.time`
- `duration`: mirrors Phoenix end time when valid, otherwise local timeline duration
- `isPlaying`: mirrors `PhoenixRuntimeState.playing`

Rules:

- Incoming Phoenix runtime state wins over local animation while connected.
- Local fallback state may remain visible while disconnected.
