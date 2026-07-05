# Implementation Plan: GLSL Asset Editor Hot Reload

## Summary

Add a floating GLSL editor panel in Cacablu and connect it to Phoenix asset preview/commit APIs. `Actualizar` previews the current Monaco draft in Phoenix memory without touching the project DB. `Guardar` persists the draft into the project DB and writes the asset to Phoenix when connected. Asset impact responses update Events and timeline error states.

## Technical Context

- **Language/Version**: TypeScript, browser runtime.
- **Primary Dependencies**: Mantine UI, Monaco editor, existing project DB session, existing Phoenix client utilities.
- **Storage**: Project SQLite database for committed asset contents; browser memory for editor drafts.
- **Testing**: Unit tests for draft/save/client behavior where practical, Playwright/manual verification for the floating editor and Phoenix integration.

## Constraints

- Cacablu must not write Phoenix `data` directly.
- `Actualizar` must not mutate the project DB.
- Single-asset preview/save must not trigger full Phoenix project sync.
- Phoenix disconnected states should be reported as useful Events only when the user explicitly requests preview/save.

## Project Structure

- `src/panels`: GLSL editor panel and Assets/Resources double-click integration.
- `src/phoenix`: preview and persisted asset client calls.
- `src/db`: asset content read/write helpers if existing helpers are insufficient.
- `src/events`: Events entries for asset impact responses.
- `src/timeline`: visible bar error state updates.
