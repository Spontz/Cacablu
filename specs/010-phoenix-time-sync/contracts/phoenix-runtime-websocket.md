# Contract: Phoenix Runtime WebSocket

## Endpoint

Default local endpoint for the first implementation:

```text
ws://127.0.0.1:29100/ws
```

The endpoint may be configurable in code or later through UI/settings, but the first implementation can use a single local default while Phoenix's OpenSpec implementation settles the final port.

## Incoming Messages: Phoenix to Cacablu

### runtime.state

Phoenix sends runtime state periodically while Cacablu is connected.

```json
{
  "type": "runtime.state",
  "time": 12.345,
  "playing": true,
  "fps": 60.0,
  "startTime": 0.0,
  "endTime": 180.0
}
```

Required fields:

- `type`: must be `runtime.state`
- `time`: current demo time in seconds

Optional fields:

- `playing`
- `fps`
- `startTime`
- `endTime`

Client behavior:

- Ignore malformed runtime messages without crashing.
- Apply finite `time` values to the timeline playhead.
- Apply valid `playing` values to the play/pause icon state.
- Apply finite positive `endTime` values to timeline duration.

### error

Phoenix may send structured errors.

```json
{
  "type": "error",
  "code": "invalid-message",
  "message": "Unsupported runtime command"
}
```

Client behavior:

- Keep the WebSocket open when possible.
- Show or log the error in a non-blocking way.

## Outgoing Messages: Cacablu to Phoenix

### runtime.play

```json
{
  "type": "runtime.play"
}
```

### runtime.pause

```json
{
  "type": "runtime.pause"
}
```

### runtime.toggle

```json
{
  "type": "runtime.toggle"
}
```

### runtime.seek

```json
{
  "type": "runtime.seek",
  "time": 42.0
}
```

Validation:

- Cacablu sends these messages only when the WebSocket is connected.
- `runtime.seek.time` is finite and not negative.

## Transport Button Mapping

| Button | Message |
|--------|---------|
| Go to Beginning | `runtime.seek` with `time: 0` |
| Rewind | `runtime.seek` with `time: max(currentTime - 1, 0)` |
| Play/Pause | `runtime.toggle` |
| Forward | `runtime.seek` with `time: currentTime + 1`, clamped to known duration |
| Go to End | `runtime.seek` with known Phoenix end time or local timeline duration |
