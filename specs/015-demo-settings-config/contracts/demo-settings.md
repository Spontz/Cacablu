# Contract: Demo Settings API

## GET /api/demo-settings

Reads current Phoenix demo settings and supported log detail options.

### Response

```json
{
  "ok": true,
  "settings": {
    "demoName": "Phoenix demo engine",
    "loop": true,
    "sound": true,
    "debugFloor": true,
    "logDetail": 1,
    "demoStart": 0,
    "demoEnd": 50,
    "debug": true,
    "slave": true
  },
  "logDetailOptions": [
    { "label": "None", "value": 0 },
    { "label": "Essential", "value": 1 },
    { "label": "Normal", "value": 2 },
    { "label": "Verbose", "value": 3 }
  ]
}
```

## PUT /api/demo-settings

Replaces Phoenix demo control settings. Phoenix applies them in memory and writes `data/config/control.spo`.

### Request

```json
{
  "requestId": "demo-settings-123",
  "demoName": "My demo",
  "loop": true,
  "sound": true,
  "debugFloor": true,
  "logDetail": 1,
  "demoEnd": 120
}
```

### Successful Response

```json
{
  "requestId": "demo-settings-123",
  "ok": true,
  "settings": {
    "demoName": "My demo",
    "loop": true,
    "sound": true,
    "debugFloor": true,
    "logDetail": 1,
    "demoStart": 0,
    "demoEnd": 120,
    "debug": true,
    "slave": true
  },
  "path": "config/control.spo"
}
```

### Error Response

```json
{
  "requestId": "demo-settings-123",
  "ok": false,
  "code": "invalid-demo-settings",
  "message": "logDetail must be between 0 and 3"
}
```

## Phoenix Persistence

Phoenix writes:

```text
demo_name <demoName>
debug 1
debugEnableFloor <0|1>
loop <0|1>
sound <0|1>
demo_start 0.0
demo_end <demoEnd>
slave 1
log_detail <0|1|2|3>
```
