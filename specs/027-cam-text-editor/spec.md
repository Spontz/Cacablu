# Feature Specification: CAM Text Editor With Column Highlighting

**Feature Branch**: `027-cam-text-editor`  
**Created**: 2026-08-19  
**Status**: In progress  
**Input**: User description: "Editar archivos `.cam` con el editor de texto de Cacablu. Colorear de forma diferente las columnas separadas por espacios o tabs. Abrirlos con doble click y, al guardar, enviarlos a Phoenix si están marcados y actualizar allí todas las barras o secciones que referencien el archivo."

## Runtime Context

**Browser Surface**: Resources/Pool file tree, the existing text-editor workspace surface, Events, and Timeline section state.  
**Local Engine Dependency**: Phoenix is optional for opening, editing, and saving the project copy. A connected Phoenix instance is required to write an enabled `.cam` asset to its Pool and reload dependent sections.  
**Static Deployment Impact**: Parsing and column decoration run entirely in the browser. The feature adds no backend or runtime service dependency.  
**Real-Time Sensitivity**: Column colors must follow edits without perceptible input lag. Saving one file must use scoped asset synchronization and must not trigger a full project sync.  
**File System Access Requirement**: The normal project open/save workflow retains its existing File System Access API requirement. The editor reads and writes the in-memory project database through `DbSessionRef` and does not write directly to Phoenix's filesystem.

## User Scenarios & Testing

### User Story 1 - Open And Edit A CAM File (Priority: P1)

As a user, I want to open a `.cam` file from the Cacablu filesystem and edit it as text so that camera data can be maintained without leaving Cacablu.

**Why this priority**: Opening and changing the file is the minimum useful workflow.

**Independent Test**: Load a project containing a `.cam` file, double-click it in Resources, edit its contents, and verify that reopening the same asset focuses the existing editor rather than creating a duplicate.

**Acceptance Scenarios**:

1. **Given** a project contains a `.cam` file, **When** the user double-clicks that file in Resources, **Then** Cacablu opens a text editor initialized with the current project-database content.
2. **Given** an editor is already open for the same `.cam` asset, **When** the user double-clicks the file again, **Then** Cacablu focuses that editor and does not open a duplicate.
3. **Given** a `.cam` editor is open, **When** the user types, deletes, pastes, or replaces text, **Then** the content remains editable as plain text and the project copy remains unchanged until Save is activated.
4. **Given** an asset whose extension differs only by letter case, such as `.CAM`, **When** the user double-clicks it, **Then** Cacablu recognizes it as a CAM file.

---

### User Story 2 - Identify Data Columns Visually (Priority: P1)

As a user, I want values in different CAM columns to have different colors so that I can identify the meaning and position of every number across rows.

**Why this priority**: Column recognition is the feature's main editing aid and prevents accidental changes to the wrong value.

**Independent Test**: Open representative CAM content containing spaces, tabs, and mixed whitespace; verify that the nth value has one consistent color on every row and adjacent columns remain visually distinct while editing.

**Acceptance Scenarios**:

1. **Given** rows whose values are separated by one or more spaces, **When** the file is displayed, **Then** each non-whitespace value is colored according to its zero-based column position.
2. **Given** rows whose values are separated by tabs, **When** the file is displayed, **Then** the same column-color rule applies.
3. **Given** a file that mixes spaces and tabs within or between rows, **When** columns are calculated, **Then** every contiguous run of horizontal whitespace acts as one separator and does not create phantom columns.
4. **Given** the same column position on multiple rows, **When** those rows are rendered, **Then** their values use the same deterministic color.
5. **Given** adjacent column positions, **When** their values are rendered, **Then** the colors are visually distinguishable in the active Cacablu editor theme.
6. **Given** the user changes separators or adds/removes values, **When** the editor content changes, **Then** column colors update to reflect the current text without changing any character.

---

### User Story 3 - Save And Refresh Phoenix Dependents (Priority: P1)

As a user, I want saving a CAM file to persist it and refresh every Phoenix section that references it so that the running demo immediately uses the accepted camera data.

**Why this priority**: A saved asset and the running engine must remain consistent.

**Independent Test**: Save an enabled `.cam` file referenced by multiple sections while Phoenix is connected; verify the project bytes and Phoenix asset match the editor, every dependent section is attempted, and Timeline/Events reflect the structured result.

**Acceptance Scenarios**:

1. **Given** an edited `.cam` file, **When** the user activates Save, **Then** Cacablu stores the current text as UTF-8 in that same project asset and marks the project dirty.
2. **Given** the `.cam` asset is enabled/marked and Phoenix is connected, **When** the local save succeeds, **Then** Cacablu sends that single asset to its normalized `pool/...` path in Phoenix as a persisted write.
3. **Given** multiple Phoenix sections reference the saved asset path, **When** Phoenix processes the write, **Then** Phoenix attempts to reload every dependent section and returns the result for each affected section.
4. **Given** Phoenix reports successfully reloaded sections, **When** Cacablu handles the response, **Then** matching visible Timeline bars clear asset-related error state and resolved scoped Events are cleared.
5. **Given** Phoenix reports failed or deactivated sections, **When** Cacablu handles the response, **Then** matching visible Timeline bars are marked as errors and Events identify every affected section.
6. **Given** the `.cam` asset is disabled/unmarked, **When** the user saves it, **Then** Cacablu persists the project copy but does not send the file to Phoenix or request dependent-section refresh.
7. **Given** the `.cam` asset is enabled but Phoenix is disconnected, **When** the user saves it, **Then** the project save remains committed and Cacablu records a clear warning that Phoenix was not updated.

### Edge Cases

- Empty files and blank lines remain editable and render without column decorations.
- Leading and trailing horizontal whitespace does not create extra columns; its exact characters remain untouched unless the user edits them.
- Rows may contain different numbers of values; available values are colored by their position without blocking editing or saving.
- Tokens are highlighted by position even when a token is not a valid number; Cacablu does not silently correct, reorder, normalize, or validate CAM data in this feature.
- Saving text with mixed spaces, tabs, or line endings preserves the editor content exactly apart from UTF-8 encoding.
- If the file is deleted, moved, renamed, or replaced while its editor is open, Cacablu must not overwrite a different or stale asset and must report the unavailable target.
- If Phoenix accepts the asset write but one dependent section fails to reload, other dependent sections are still attempted and their individual outcomes remain visible.
- If the user closes an editor with unsaved changes, the existing text-editor unsaved-change policy applies; this feature must not discard changes silently.

## Requirements

### Functional Requirements

- **FR-001**: Cacablu MUST recognize `.cam` file extensions case-insensitively in the Resources/Pool tree.
- **FR-002**: Double-clicking a `.cam` file MUST open a text editor for that exact asset.
- **FR-003**: Opening an already-open `.cam` asset MUST focus its existing editor instead of creating a duplicate.
- **FR-004**: The editor MUST load the current asset bytes as UTF-8 text and permit unrestricted plain-text editing.
- **FR-005**: The editor MUST treat each contiguous run of spaces and/or tabs as a column separator for visual highlighting.
- **FR-006**: The editor MUST assign a deterministic color by token column position, using the same color for the same position across rows and visually distinct colors for adjacent positions.
- **FR-007**: Column highlighting MUST update as the content changes and MUST NOT insert, remove, replace, or normalize file characters.
- **FR-008**: Empty lines, leading/trailing whitespace, mixed separators, irregular row widths, and non-numeric tokens MUST remain editable and MUST NOT prevent saving.
- **FR-009**: Save MUST encode the current editor text as UTF-8, update the same project-database asset, and mark the project dirty.
- **FR-010**: Save MUST participate in the existing application Undo history so one Undo restores the complete prior file content.
- **FR-011**: Saving an enabled `.cam` asset while Phoenix is connected MUST perform one scoped persisted asset write using its normalized `pool/...` path.
- **FR-012**: Saving a disabled `.cam` asset MUST NOT write, publish, preview, or otherwise update that asset in Phoenix.
- **FR-013**: Saving an enabled `.cam` asset while Phoenix is disconnected MUST retain a successful local project save and MUST report the skipped Phoenix update through Events without an alert.
- **FR-014**: A Phoenix persisted write MUST find and attempt to reload every loaded section that references the exact normalized asset path; one section failure MUST NOT prevent other dependent sections from being attempted.
- **FR-015**: Cacablu MUST handle the existing asset-impact result sets `reloadedSections`, `deactivatedSections`, and `failedSections` for the saved CAM asset.
- **FR-016**: Cacablu MUST clear resolved asset-related error state for successfully reloaded sections and mark failed or deactivated visible Timeline bars as erroneous.
- **FR-017**: Cacablu MUST record failed/deactivated section IDs and useful Phoenix diagnostics in Events, scoped so unrelated Events are preserved.
- **FR-018**: Saving one `.cam` asset MUST NOT trigger a full Pool or project synchronization.
- **FR-019**: The feature MUST use the in-memory `ProjectDatabase` through `DbSessionRef` and MUST NOT query SQLite or write Phoenix's filesystem directly from panel code.
- **FR-020**: Column decoration and editing MUST remain responsive for normal project CAM files and MUST preserve static browser-only deployment without a new runtime dependency.

### Key Entities

- **CAM Asset**: A case-insensitive `.cam` resource stored in the project database, with an enabled/marked state and a normalized Pool path.
- **CAM Editor Instance**: One text-editor panel bound to one CAM asset identity and its editable in-memory draft.
- **Column Token**: A non-whitespace span whose column position is determined independently on each line by preceding horizontal-whitespace separators.
- **Column Color Assignment**: A deterministic mapping from column position to an editor-theme-compatible foreground color.
- **Persisted Asset Write**: The existing scoped Phoenix operation that writes an enabled asset and returns dependent-section impact.
- **Asset Impact Result**: Phoenix's per-section `reloadedSections`, `deactivatedSections`, and `failedSections` response.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Double-clicking a `.cam` file opens its editable content in one action, and repeated double-clicks leave exactly one editor instance for that asset.
- **SC-002**: Automated highlighting tests cover space-separated, tab-separated, mixed-separator, leading/trailing-whitespace, blank, irregular, and edited rows with correct column assignments.
- **SC-003**: In representative files, 100% of tokens at the same column position share a color and 100% of adjacent populated columns use distinguishable colors without altering source text.
- **SC-004**: Saving an enabled referenced CAM file updates the project copy and Phoenix copy and reports an outcome for every dependent section without full-project sync.
- **SC-005**: Saving a disabled CAM file produces zero Phoenix requests, while saving enabled content offline retains the local change and produces one clear warning.
- **SC-006**: Undo after Save restores the exact previous bytes as one action and follows the enabled/offline Phoenix rules for the restored content.
- **SC-007**: Manual browser validation confirms opening, live column coloring, editing, saving, and dependent Timeline/Event updates with Phoenix connected.
- **SC-008**: Typecheck, focused unit tests, lint for changed code, and production build pass without new errors.

## Assumptions

- "Marcado" means the existing enabled checkbox/state of a Pool file.
- `.cam` files are text assets encoded as UTF-8; this feature does not define or enforce a fixed number or semantic meaning of columns.
- Spaces and tabs are equivalent only for identifying visual columns. Save preserves the exact separators present in the editor.
- Save is the existing text-editor Save action; a separate transient `Actualizar`/preview action is not requested for CAM files.
- Phoenix's existing persisted asset-write and asset-impact contract is extended/reused for `.cam`; no new transport or full-project synchronization is required.
- Section references are matched by the exact normalized Pool asset path, consistent with current Phoenix dependency tracking.
