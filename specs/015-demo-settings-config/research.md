# Research: Demo Settings Config

## Decision: Log Detail Values

Phoenix currently defines:

```cpp
enum class LogLevel {
    none = 0,
    high = 1,
    med = 2,
    low = 3
};
```

`Logger::setLogLevel` only accepts values less than or equal to `LogLevel::low`, so values above `3` are ignored. The example `log_detail 4` is therefore a legacy or invalid value in the current engine.

The UI will expose:

- `0`: None
- `1`: Essential
- `2`: Normal
- `3`: Verbose

If Phoenix reads legacy `log_detail 4`, it should normalize it to `3 Verbose` when exposing settings to Cacablu. Cacablu must never write `4`.

## Decision: Source Of demo_end

Cacablu owns the timeline database and can calculate the maximum bar end time without asking Phoenix. Therefore Cacablu will send `demoEnd` in the payload.

If there are no bars, `demoEnd` is `0`.

## Decision: File Ownership

Phoenix owns `data/config/control.spo`. Cacablu sends normalized settings through the network API and never writes Phoenix's filesystem directly.

## Decision: UI Shape

The panel should follow the current Cacablu floating panel styling and Mantine controls, not reproduce the legacy Phoenix native UI. It opens from `Edit > Demo Settings` and can be opened even when Phoenix is disconnected.
