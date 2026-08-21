# Data Model: Monaco Text Search

This feature introduces no persisted application entities, database fields, or transport records.

## Transient State

Monaco's existing Find contribution owns transient per-editor state:

- search query;
- current match and total matches;
- case-sensitive, whole-word, and regular-expression options;
- widget visibility and input focus;
- temporary match decorations.

Cacablu does not copy this state into `AppState`, `DbState`, project data, local storage, or Undo history. Disposal remains tied to the owning Monaco editor.
