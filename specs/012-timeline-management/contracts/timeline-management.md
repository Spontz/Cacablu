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

- disconnected Phoenix: do not send a request, do not record a synthetic sync failure, and keep the local edit
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

Known section sync errors MUST update a tracked section-error id set. Timeline error style is driven by that set and remains stable until the affected ids are cleared by successful resync or project reset.

## Bar Editor Controls

The Bar Editor MUST expose:

- `Bar Type` selector
- `Script Template` selector
- `Save Template` button
- code editing field
- `Blend Source` selector
- `Blend Destination` selector
- `Blend Equation` selector
- `Apply` button

`Apply` MUST persist name, bar type, script, start time, end time, source blend, destination blend, and blend equation to the active project session. Blend Equation user-facing values are `Add`, `Subtract`, and `Reverse subtract`; persisted values remain Phoenix-compatible.

If edited time fields are invalid, `Apply` MUST preserve the previous valid time range while still persisting valid non-time edits. Local edits MUST be kept in memory and in the active session even when Phoenix rejects the synchronized section.

Single-clicking a timeline bar MUST open or reinitialize the Bar Editor on the right, including when the same selected bar is clicked again.

## Monaco Overflow Contract

The Bar Editor code editor MUST configure Monaco overflow widgets so that editor-owned popups are not clipped by Dockview panels and are not hidden behind the timeline.

Required behavior:

- suggest widgets, context menus, and hover widgets render above all docked panels
- widget positioning is computed against a stable document-level overlay, not a clipped panel viewport
- browser automation SHOULD verify that `document.elementFromPoint()` over a visible Monaco popup resolves to the popup or one of its descendants

## No New Phoenix Protocol Expected

This feature SHOULD NOT add new Phoenix endpoints. It reuses:

- section manifest
- full section replacement
- single-section update for committed bar moves or Bar Editor Apply
- Phoenix WebSocket events/errors
