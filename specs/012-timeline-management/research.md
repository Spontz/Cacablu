# Research: Timeline Management

## Decision: Use Project Database Bars As Source Of Truth

**Decision**: Timeline clips are derived from the loaded project's `BARS` table and committed edits write back to that same project session.

**Rationale**: Project save/reopen and Phoenix section sync both depend on database bars. A separate timeline-only model would create drift.

**Alternatives Considered**:
- Keep edits only in UI state until save. Rejected because Phoenix sync would not know which state is authoritative.
- Add a new timeline schema. Rejected because current bars already represent the required section timeline.

## Decision: Commit On Interaction End

**Decision**: Drag/resize previews can update UI during pointer movement, but database persistence and Phoenix sync happen when the interaction commits.

**Rationale**: This preserves responsiveness and avoids flooding both SQLite writes and Phoenix section replacement.

**Alternatives Considered**:
- Persist every pointer move. Rejected as noisy and riskier for performance.

## Decision: Debounce Phoenix Sync

**Decision**: Committed edits schedule a debounced section sync using the existing project bar snapshot sync.

**Rationale**: Multiple edits often happen as a burst. Debouncing minimizes redundant full section replacement.

**Alternatives Considered**:
- Add targeted single-section patching. Rejected for this change because Phoenix already has full replacement and exact-match semantics.

## Decision: Keep Local Edits On Sync Failure

**Decision**: Phoenix sync failures create Events and do not roll back project edits.

**Rationale**: Cacablu must remain useful offline or while Phoenix is temporarily rejecting a script.

**Alternatives Considered**:
- Roll back local edits if Phoenix rejects. Rejected because it makes timeline editing dependent on engine state.
