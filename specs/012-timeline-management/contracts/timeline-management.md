# Contract: Timeline Management

## Local Project Bar Operations

Cacablu MUST provide internal project-session operations for:

- create bar
- update bar timing
- update bar layer
- update editable bar properties
- delete bar

Each operation MUST validate input before mutating project data.

## Phoenix Section Sync Trigger

After a committed timeline edit, Cacablu MUST schedule a debounced section sync when Phoenix is connected.

Sync source:

- current loaded project database bars

Sync target:

- Phoenix editor section API already used by project-open section synchronization

Failure behavior:

- disconnected Phoenix: record an Event and keep local edit
- validation error: record an Event and keep local edit
- Phoenix rejected section: record Events with affected bar ids when available and keep local edit

Progress behavior:

- show `current/total` only when Cacablu is processing real local units, such as preparing section payloads
- show `current/total` while checking prepared sections against Phoenix's section manifest
- do not show stale `0/N` counters for one-shot Phoenix HTTP calls that cannot report partial progress
- preserve the latest real progress bar value during one-shot Phoenix HTTP calls instead of resetting it to zero
- update the modal label and progress bar from the same real progress snapshot

## Event Payload Expectations

Timeline sync Events SHOULD include:

- severity: `warning` or `error`
- source: `Timeline section sync` or `Phoenix section sync`
- subject id: bar id when known
- description: human-readable failure or status

Known section sync errors MUST drive the timeline error style for matching bars until the Events collection is cleared.

## Section Editor Controls

The Section Editor MUST expose:

- `Bar Type` selector
- `Script Template` selector
- `Save Template` button
- code editing field
- `Blend Source` selector
- `Blend Destination` selector
- `Blend Equation` selector
- `Apply` button

`Apply` MUST persist script, source blend, destination blend, and blend equation to the active project session. Blend Equation user-facing values are `Add`, `Subtract`, and `Reverse subtract`; persisted values remain Phoenix-compatible.

Single-clicking a timeline bar MUST open or reinitialize the Section Editor on the right, including when the same selected bar is clicked again.

## No New Phoenix Protocol Expected

This feature SHOULD NOT add new Phoenix endpoints. It reuses:

- section manifest
- full section replacement
- Phoenix WebSocket events/errors
