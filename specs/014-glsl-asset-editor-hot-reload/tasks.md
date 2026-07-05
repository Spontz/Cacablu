## Phase 1: Asset Editor State

- [x] T001 Add `AssetEditorDraft` and `AssetImpactResult` types.
- [x] T002 Add helpers to read `.glsl` asset content from the loaded project DB as UTF-8 text.
- [x] T003 Add helpers to write edited `.glsl` content back to the project DB asset record.

## Phase 2: Phoenix Client

- [x] T004 Add `PUT /api/assets/preview` client support.
- [x] T005 Normalize asset paths sent to Phoenix as `pool/...` or `resources/...`.
- [x] T006 Parse asset impact responses from preview, persisted writes, delete, unpublish, and move operations.
- [x] T007 Route Phoenix errors and section impact diagnostics to Events.

## Phase 3: GLSL Editor UI

- [x] T008 Detect double-click on `.glsl` files in Assets/Resources.
- [x] T009 Open or focus a floating GLSL editor panel for the selected asset.
- [x] T010 Embed Monaco with GLSL syntax highlighting, line numbers, and existing code-editor visual settings.
- [x] T011 Add `Actualizar` and `Guardar` actions.
- [x] T012 Track dirty draft state without mutating the project DB before save.

## Phase 4: Update And Save Flows

- [x] T013 Implement `Actualizar` so it sends the Monaco draft to Phoenix without saving DB or disk.
- [x] T014 Implement `Guardar` so it writes the project DB asset record.
- [x] T015 After DB save, send the persisted asset write to Phoenix when connected.
- [x] T016 Keep the editor open and write Events when Phoenix rejects preview or save.
- [x] T017 Avoid full project sync for single-asset preview or save.

## Phase 5: Asset Impact Across The App

- [x] T018 Apply asset impact response handling to delete, unpublish, move, and persisted asset writes.
- [x] T019 Mark visible timeline bars as error bars for failed or deactivated section IDs.
- [x] T020 Avoid noisy Phoenix sync Events for asset impact operations skipped while Phoenix is disconnected.

## Phase 6: Verification

- [ ] T021 Test that `Actualizar` does not change the project DB.
- [ ] T022 Test that `Guardar` changes the project DB and calls Phoenix when connected.
- [ ] T023 Test that dependent section IDs from Phoenix appear in Events.
- [ ] T024 Manually verify a GLSL edit previews in Phoenix and only persists after `Guardar`.
