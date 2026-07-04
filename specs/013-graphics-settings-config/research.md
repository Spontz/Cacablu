# Research: Graphics Settings Config

## Decision: Send A Complete Graphics Snapshot

**Decision**: Cacablu sends the full rendering context and all 25 FBO rows in one OK request.

**Rationale**: Phoenix needs a consistent `graphics.spo` file and in-memory FBO configuration. Partial row updates could leave the runtime and disk file inconsistent if a later row fails.

**Alternatives Considered**:

- Send individual row updates: rejected because it complicates rollback and file persistence.
- Directly write `graphics.spo` from Cacablu: rejected because Phoenix owns its active data folder and runtime apply.

## Decision: Keep Errors In Events

**Decision**: Validation and Phoenix errors are routed to the Events panel, not browser alerts.

**Rationale**: Cacablu already uses Events for diagnostics, and alerts interrupt editing without preserving history.

## Decision: Use Phoenix Generic FBO Rows Only

**Decision**: The dialog edits generic FBO rows `0..24`.

**Rationale**: Phoenix has dedicated effect and preview FBO ownership that must not be mixed with user-editable generic FBO settings.

## Decision: Map UI Labels To Engine Values

**Decision**: UI labels can be friendly, but payload values use Phoenix names. `Bilinear` maps to `bilinear`; `No` maps to `none`; FBO formats use exact Phoenix strings.

**Rationale**: Exact payload names avoid aliases and keep Phoenix validation strict.
