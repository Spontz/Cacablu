## Phase 1: Types And Normalization

- [x] T001 Define `GraphicsConfig`, `GraphicsContextSettings`, and `FboConfigRow` types.
- [x] T002 Add project DB readers that normalize graphics variables and FBO rows into a 25-row `GraphicsConfig`.
- [x] T003 Add project DB writers for committed graphics context and FBO values.
- [x] T004 Add validation helpers for context fields, row coverage, FBO formats, dimensions, attachments, and filters.

## Phase 2: Phoenix Client

- [x] T005 Add a `PUT /api/graphics` client using the existing Phoenix connection base URL.
- [x] T006 Parse Phoenix success, warning, and structured error responses.
- [x] T007 Route disconnected, network, validation, and Phoenix errors to Events.

## Phase 3: Panel UI

- [x] T008 Add `Edit > Graphics` below a separator in the Edit menu.
- [x] T009 Build the floating Graphics panel with rendering context controls.
- [x] T010 Build the 25-row editable FBO table with dropdowns and numeric inputs.
- [x] T011 Highlight invalid fields and keep the panel open on validation failure.
- [x] T012 Keep panel edits in a draft that is discarded on Cancel.

## Phase 4: Commit Flow

- [x] T013 On OK, validate the draft before persistence or transmission.
- [x] T014 Commit validated values to the loaded project graphics state.
- [x] T015 Send the complete config to Phoenix only when Phoenix is connected.
- [x] T016 Close the panel only after Phoenix returns `ok: true`.
- [x] T017 Keep the panel open and write Events when Phoenix rejects or fails the request.

## Phase 5: Verification

- [ ] T018 Add unit tests for normalization and validation.
- [ ] T019 Add unit tests for Phoenix graphics client response handling.
- [ ] T020 Manually verify Phoenix writes `data/config/graphics.spo` and applies the settings.

