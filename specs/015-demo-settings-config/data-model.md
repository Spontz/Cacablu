# Data Model: Demo Settings Config

## DemoSettingsDraft

Editable state held by the Demo Settings panel.

| Field | Type | Notes |
| --- | --- | --- |
| `demoName` | `string` | Required after trimming. Written as `demo_name`. |
| `loop` | `boolean` | Written as `loop 1` or `loop 0`. |
| `sound` | `boolean` | Written as `sound 1` or `sound 0`. |
| `debugGrid` | `boolean` | Written as `debugEnableGrid 1` or `debugEnableGrid 0`. |
| `logDetail` | `0 | 1 | 2 | 3` | Log detail option selected by the user. |

## TimelineDemoEnd

Calculated value, not directly edited in the panel.

| Field | Type | Notes |
| --- | --- | --- |
| `demoEnd` | `number` | Maximum end time of all bars in the loaded project. `0` when no bars exist. |

## LogDetailOption

User-facing popup option.

| Field | Type | Notes |
| --- | --- | --- |
| `label` | `string` | `None`, `Essential`, `Normal`, or `Verbose`. |
| `value` | `0 | 1 | 2 | 3` | Phoenix `LogLevel` value. |

## DemoSettingsPayload

Network request body sent to Phoenix.

| Field | Type | Notes |
| --- | --- | --- |
| `requestId` | `string` | Correlates request and response. |
| `demoName` | `string` | Trimmed demo title. |
| `loop` | `boolean` | Loop flag. |
| `sound` | `boolean` | Sound enabled flag. |
| `debugGrid` | `boolean` | Debug grid flag. |
| `logDetail` | `0 | 1 | 2 | 3` | Supported log level only. |
| `demoEnd` | `number` | Current maximum bar end time. |

## DemoSettingsResponse

Phoenix response.

| Field | Type | Notes |
| --- | --- | --- |
| `requestId` | `string` | Mirrors request when present. |
| `ok` | `boolean` | Success flag. |
| `settings` | `DemoSettingsPayload` | Normalized accepted settings when successful. |
| `path` | `string` | Expected to be `config/control.spo` on write success. |
| `code` | `string` | Structured error code when `ok` is false. |
| `message` | `string` | Human-readable diagnostic for Events. |
