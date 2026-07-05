# Feature Specification: GLSL Asset Editor Hot Reload

**Feature Branch**: `014-glsl-asset-editor-hot-reload`  
**Created**: 2026-07-04  
**Status**: Draft  
**Input**: User description: "Al hacer doble click en un archivo `.glsl`, abrir una ventana con Monaco y botones de Actualizar y Guardar. Actualizar envia el archivo a Phoenix en memoria sin guardar DB ni disco. Guardar escribe en DB y en Phoenix. Phoenix debe recargar o desactivar las secciones que usan assets afectados."

## Runtime Context *(mandatory)*

**Browser Surface**: Assets/Resources panel, floating GLSL editor panel, Monaco editor, Events panel, timeline bars, Phoenix connection state, and project database session.  
**Local Engine Dependency**: Phoenix is required for live preview and Phoenix disk commits. The editor can open and edit drafts while Phoenix is disconnected.  
**Static Deployment Impact**: Cacablu remains a static browser app and uses `fetch`, local project DB APIs, and browser-local editor state.  
**Real-Time Sensitivity**: `Actualizar` must be fast enough for shader iteration and must not trigger a full project sync.  
**File System Access Requirement**: Cacablu writes project DB content through its project DB layer. Cacablu never writes Phoenix's `data` folder directly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open GLSL Editor (Priority: P1)

As a user, I want double-clicking a `.glsl` asset to open a code editor so that I can edit shader files from Cacablu.

**Independent Test**: Load a project with a `.glsl` asset, double-click it in Assets/Resources, and verify a floating editor opens with Monaco syntax highlighting and the file contents.

**Acceptance Scenarios**:

1. **Given** a project is loaded, **When** the user double-clicks a `.glsl` file in Assets or Resources, **Then** Cacablu opens a floating GLSL editor panel.
2. **Given** a `.glsl` editor is already open for the same asset, **When** the user double-clicks that asset again, **Then** Cacablu focuses the existing editor instead of opening a duplicate.
3. **Given** the editor opens, **When** Monaco initializes, **Then** it uses GLSL syntax highlighting, line numbers, and the current code-editor styling used elsewhere in Cacablu.

---

### User Story 2 - Preview Shader Changes Without Saving (Priority: P1)

As a user, I want `Actualizar` to send the current shader draft to Phoenix without saving it so that I can preview changes safely.

**Independent Test**: Edit a `.glsl` file, press `Actualizar`, verify Cacablu sends the draft to Phoenix's transient asset preview endpoint, and verify the project DB value remains unchanged.

**Acceptance Scenarios**:

1. **Given** the editor contains unsaved changes and Phoenix is connected, **When** the user presses `Actualizar`, **Then** Cacablu sends the current editor text to Phoenix as a transient asset preview.
2. **Given** `Actualizar` succeeds, **When** Cacablu receives Phoenix's response, **Then** Cacablu writes any affected section results to Events and does not mutate the project DB.
3. **Given** Phoenix is disconnected, **When** the user presses `Actualizar`, **Then** Cacablu does not attempt a network request and writes a clear Event.

---

### User Story 3 - Save Shader Changes (Priority: P1)

As a user, I want `Guardar` to commit GLSL edits to the project and to Phoenix so that accepted shader changes persist.

**Independent Test**: Edit a `.glsl` file, press `Guardar`, verify the project DB file bytes change, verify the asset is sent to Phoenix as a persisted write, and verify affected section results are written to Events.

**Acceptance Scenarios**:

1. **Given** the editor contains valid GLSL text, **When** the user presses `Guardar`, **Then** Cacablu writes the text to the project DB asset record.
2. **Given** Phoenix is connected, **When** `Guardar` commits the project DB change, **Then** Cacablu sends the same content to Phoenix as a persisted asset write.
3. **Given** Phoenix is disconnected, **When** `Guardar` commits the project DB change, **Then** Cacablu keeps the DB change and writes an Event explaining Phoenix disk was not updated.
4. **Given** Phoenix returns dependent section failures, **When** Cacablu handles the response, **Then** Cacablu writes those section IDs to Events and marks the matching timeline bars as error bars when they are visible.

---

### User Story 4 - Asset Impact Beyond GLSL (Priority: P1)

As a user, I want asset publish, unpublish, delete, move, and edit operations to keep Phoenix sections consistent so that invalid sections stop running.

**Independent Test**: Unpublish or delete an asset referenced by a section, verify Cacablu calls the Phoenix asset operation, and verify Phoenix reports affected section IDs which Cacablu shows in Events.

**Acceptance Scenarios**:

1. **Given** a published asset is used by one or more sections, **When** the asset is changed and Phoenix is connected, **Then** Cacablu handles Phoenix's `reloadedSections`, `deactivatedSections`, and `failedSections` response.
2. **Given** an asset is unpublished, deleted, or moved away, **When** Phoenix reports dependent sections as deactivated, **Then** Cacablu writes an Event with those section IDs.
3. **Given** Phoenix is disconnected, **When** local asset operations happen, **Then** Cacablu must not create noisy "sync failed" Events for Phoenix impact operations that were not attempted.

### Edge Cases

- What happens when a `.glsl` file is too large for the preview request?
- What happens when the user closes an editor with unsaved changes?
- What happens when Phoenix accepts the preview but a dependent section fails to reload?
- What happens when the asset path changes while an editor is open?
- What happens when a draft has been previewed but the user later saves a different version?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cacablu MUST open a floating GLSL editor panel when the user double-clicks a `.glsl` asset.
- **FR-002**: Cacablu MUST initialize the editor from the current project DB asset content.
- **FR-003**: The GLSL editor MUST use Monaco with GLSL syntax highlighting and line numbers.
- **FR-004**: The GLSL editor MUST provide `Actualizar` and `Guardar` actions.
- **FR-005**: `Actualizar` MUST send the current draft to Phoenix as a transient preview and MUST NOT save the draft to the project DB.
- **FR-006**: `Actualizar` MUST NOT write directly to Phoenix disk.
- **FR-007**: `Guardar` MUST write the current draft to the project DB asset record.
- **FR-008**: `Guardar` MUST send the current draft to Phoenix as a persisted asset write when Phoenix is connected.
- **FR-009**: Cacablu MUST handle Phoenix asset impact responses containing `reloadedSections`, `deactivatedSections`, and `failedSections`.
- **FR-010**: Cacablu MUST write asset impact errors and affected section IDs to Events instead of showing alerts.
- **FR-011**: Cacablu MUST mark visible timeline bars as error bars when Phoenix reports those sections as failed or deactivated.
- **FR-012**: Cacablu MUST handle asset impact responses for non-GLSL asset publish, unpublish, delete, move, and persisted write operations.
- **FR-013**: Cacablu MUST avoid full project sync when only one asset is previewed or saved.
- **FR-014**: Cacablu MUST not emit Phoenix sync failure Events for asset impact operations skipped because Phoenix is disconnected.
- **FR-015**: If an editor already exists for an asset, double-clicking that asset MUST focus the existing editor.

### Key Entities

- **GLSL Editor Panel**: Floating panel containing Monaco and the asset update/save controls.
- **Asset Draft**: In-memory text value being edited before save.
- **Transient Preview Request**: Network request that sends a draft to Phoenix runtime memory only.
- **Persisted Asset Write**: Existing asset save flow that writes the project DB and, when connected, Phoenix disk.
- **Asset Impact Result**: Phoenix response describing reloaded, deactivated, and failed section IDs.
- **Section Impact Event**: Events-panel entry used to explain which sections changed state because of an asset operation.
