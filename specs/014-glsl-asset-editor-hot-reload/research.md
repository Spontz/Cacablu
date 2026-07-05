# Research: GLSL Asset Editor Hot Reload

## Decision: Use a floating panel instead of a tabbed route

**Rationale**: Existing Cacablu editing tools use floating panels, and the GLSL editor needs to coexist with Assets, Bar Editor, Events, and Preview while the user iterates.

**Alternatives considered**:

- Dedicated page: rejected because it hides timeline context.
- Inline asset preview: rejected because shader editing needs Monaco-sized space and explicit update/save controls.

## Decision: Preview through Phoenix memory overlay

**Rationale**: The user needs to see shader changes without changing DB or Phoenix disk. The cleanest browser-side model is a transient network request that sends the draft text and receives affected section IDs.

**Alternatives considered**:

- Save to DB then rollback: rejected because it risks dirty project state and confusing undo.
- Write temp files in Phoenix data: rejected because disk should remain unchanged during preview.

## Decision: Use Events for all failures and section impact information

**Rationale**: The app already uses Events for Phoenix diagnostics and the user explicitly does not want alerts or noisy sync-failed messages when Phoenix was not connected.

## Decision: Keep one editor instance per asset

**Rationale**: Duplicate editors for the same file can produce conflicting drafts. Focusing an existing editor preserves user intent and avoids hidden stale state.
