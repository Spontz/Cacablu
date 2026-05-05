# Feature Specification: 3D Model Preview in Inspector

**Feature Branch**: `008-3d-preview-inspector`  
**Created**: 2026-05-05  
**Status**: Completed  
**Input**: User description: "crear la preview en el inspector de los modelos 3D que se seleccionen en el arbol de archivos"

## Runtime Context *(mandatory)*

**Browser Surface**: The Resources file explorer and the Inspector panel inside the same project window; selecting a 3D model file in Resources updates the Inspector panel for that project only  
**Local Engine Dependency**: The feature does not require the local visuals engine for the core preview; it reads model asset content from the in-memory project database session already owned by the project window  
**Static Deployment Impact**: The feature must remain fully usable in a static browser application with no backend or server dependency  
**Real-Time Sensitivity**: The Inspector panel must react promptly to selection changes and remain responsive while loading or failing to load typical embedded model assets  
**File System Access Requirement**: The feature does not access the file system directly; it uses file entries already loaded from the project database

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview Selected 3D Model (Priority: P1)

As a user, I want the Inspector panel to show a visual preview of the 3D model file I select in the Resources file explorer so that I can identify model assets without opening another tool.

**Why this priority**: The 3D preview is the primary value of the feature; without it selected model files cannot be inspected visually.

**Independent Test**: Open a project containing at least one supported 3D model file, select that model in Resources, and confirm that the Inspector panel displays a visual 3D preview associated with the selected file.

**Acceptance Scenarios**:

1. **Given** a project is open and Resources lists a supported 3D model file, **When** the user selects that file, **Then** the Inspector panel shows a visual 3D model preview.
2. **Given** a 3D model preview is visible, **When** the user selects a different supported 3D model file, **Then** the Inspector panel replaces the preview with the newly selected model.
3. **Given** a 3D model file is selected, **When** the Inspector panel is visible, **Then** the preview is clearly associated with the selected file name.

---

### User Story 2 - Inspect Model Shape Interactively (Priority: P2)

As a user, I want to rotate or inspect the selected 3D model preview so that I can understand the asset shape from more than one angle.

**Why this priority**: A static model view may hide important geometry; basic interaction makes the preview useful for inspection.

**Independent Test**: Select a supported 3D model and interact with the preview area to confirm the model view changes while remaining within the Inspector panel.

**Acceptance Scenarios**:

1. **Given** a 3D model preview is visible, **When** the user drags or otherwise interacts with the preview, **Then** the model view changes to reveal another angle.
2. **Given** a 3D model preview is visible, **When** the user uses the mouse wheel, **Then** the model view zooms in or out within safe limits.
3. **Given** a 3D model preview is visible, **When** the user holds Shift and drags inside the preview, **Then** the model pans within the preview frame.
4. **Given** the model view has changed, **When** the user selects another file and returns to a model selection, **Then** the preview starts in a predictable default view.
5. **Given** the Inspector panel is resized, **When** the preview remains visible, **Then** the model view fits inside the panel without overlapping other inspector content.

---

### User Story 3 - Handle Non-Model Selection (Priority: P2)

As a user, I want the Inspector panel to avoid showing stale 3D previews when I select folders, images, or other non-model files so that the Inspector always reflects the current selection.

**Why this priority**: Stale 3D previews would mislead users about which asset is selected.

**Independent Test**: Select a model to show a preview, then select a folder, image, or non-model file and confirm that the Inspector panel clears the model preview and shows the correct current-selection state.

**Acceptance Scenarios**:

1. **Given** a 3D preview is visible, **When** the user selects a folder, **Then** the Inspector panel clears the model preview and shows a folder or neutral non-preview state.
2. **Given** a 3D preview is visible, **When** the user selects an image file, **Then** the Inspector panel clears the model preview and may show the image preview behavior already supported by the Inspector.
3. **Given** a 3D preview is visible, **When** the user selects a non-previewable file, **Then** the Inspector panel clears the model preview and indicates that no 3D preview is available for the current file.

---

### User Story 4 - Communicate Model Preview Problems (Priority: P3)

As a user, I want the Inspector panel to show a clear fallback when a selected 3D model cannot be previewed so that I understand whether the asset is unsupported, missing, or invalid.

**Why this priority**: Broken or unsupported model data is not the main flow, but the panel must fail clearly when it occurs.

**Independent Test**: Select model-like files with missing, unsupported, or invalid content and confirm that the Inspector panel shows a clear preview-unavailable state.

**Acceptance Scenarios**:

1. **Given** a selected file appears to be a model but has no readable content, **When** the Inspector panel updates, **Then** it shows a clear preview-unavailable state for that file.
2. **Given** a selected model file uses an unsupported or invalid format, **When** preview loading fails, **Then** the Inspector panel avoids showing a blank or stale model and displays a fallback state.
3. **Given** a very large or complex supported model is selected, **When** the Inspector panel attempts to preview it, **Then** the application remains responsive and provides either a visible preview or a clear fallback.

### Edge Cases

- What happens when the selected model file has missing or empty binary content?
- What happens when a file has a model-like extension but cannot be decoded as a model?
- What happens when a model is much larger or more complex than typical project assets?
- What happens when the user rapidly changes selection between models, images, folders, and other files?
- What happens when the Inspector panel is hidden or resized while a model preview is visible?
- What happens when the selected model file has a null, empty, or duplicate name?
- What happens when a model references external companion assets that are not embedded in the project database?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Selecting a supported 3D model file in the Resources file explorer MUST update the Inspector panel in the same project window with a visual 3D preview.
- **FR-002**: The Inspector panel MUST show the selected file name with the 3D preview so users can confirm which asset they are inspecting.
- **FR-003**: Selecting a different supported 3D model file MUST replace the previous 3D preview with the new selected model.
- **FR-004**: The 3D preview MUST fit within the available Inspector panel space without overlapping file metadata or other inspector states.
- **FR-005**: Users MUST be able to inspect a supported 3D preview from more than one angle through a simple interaction or equivalent view control.
- **FR-005a**: The preview MUST support drag rotation, mouse-wheel zoom, and Shift-drag panning.
- **FR-006**: Selecting a folder, image, non-model file, or no item MUST clear any previous 3D preview and show an appropriate current-selection state.
- **FR-007**: The system MUST recognize common project model assets by their stored file type or name, including GLB, GLTF, OBJ, FBX, DAE, 3DS, MD2, MD3, LWO, LWS, and BLEND.
- **FR-008**: The system MUST preview supported model formats when their content is available and renderable in the browser runtime.
- **FR-008a**: The implemented previewable formats include GLB, GLTF, OBJ, FBX, DAE, 3DS, LWO, and MD2. MD3, LWS, and BLEND remain recognized fallback formats.
- **FR-008b**: The model viewer MUST resolve companion resources from files already stored in the project database when possible, including glTF buffers/textures, OBJ MTL/textures, and MD2 skin textures.
- **FR-008c**: For MD2 files, the viewer MUST attempt to apply a referenced skin texture and fallback candidates with matching model/skin basenames, including JPG/JPEG/PNG/WEBP/BMP and basic PCX skins.
- **FR-009**: If a selected model cannot be previewed because its content is missing, invalid, externally incomplete, too complex, or unsupported, the Inspector panel MUST show a clear preview-unavailable state instead of a stale or blank preview.
- **FR-010**: The 3D preview MUST be read-only; users MUST NOT be able to edit, rename, delete, transform, or move the selected asset through this feature.
- **FR-011**: Each project window MUST keep its Resources selection and Inspector preview isolated from every other project window.
- **FR-012**: The preview behavior MUST remain part of the static deployable application with no backend dependency.
- **FR-013**: The feature MUST not require the local visuals engine or any engine message to display the core 3D preview.
- **FR-014**: The Inspector MUST show the loaded model vertex count when a model preview succeeds.

### Key Entities *(include if feature involves data)*

- **Resource Selection**: The currently selected folder or file in a project window's Resources file explorer; it determines what the Inspector panel displays.
- **3D Model File**: A file entry from the project database whose stored type or name identifies it as a 3D model asset and whose content may be rendered as a visual preview.
- **Model Preview State**: The Inspector panel's current display state for a selected model, such as loading, visible preview, unsupported format, invalid content, externally incomplete, or preview unavailable.
- **Inspector Preview State**: The broader Inspector panel state for the project window, including image preview behavior from the previous feature, model preview behavior from this feature, non-preview file state, folder state, and empty selection.
- **Project Window**: A self-contained workspace window for one open project database file; it owns its Resources selection and Inspector preview exclusively.
- **Database Session**: The in-memory database owned by a project window; model preview data is read from this session and not from direct file system access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a supported embedded 3D model from Resources and see the corresponding Inspector preview in under 2 seconds for typical project models.
- **SC-002**: In manual validation, a visible 3D model preview can be inspected from at least two different angles without leaving the Inspector panel.
- **SC-003**: In manual validation, selecting a folder, image, or non-model file after previewing a model clears the previous 3D preview 100% of the time.
- **SC-004**: In manual validation with two open project windows, each Inspector panel shows only the selection from its own Resources file explorer.
- **SC-005**: At least one supported model format is previewed successfully when valid, and unsupported or invalid model-like files produce a clear preview-unavailable state.
- **SC-006**: The application remains responsive while loading typical model previews and while handling invalid or unsupported model content.
- **SC-007**: Project lint, typecheck, and build checks complete without new errors for this feature.

## Assumptions

- This feature builds on the existing Resources selection and Inspector preview behavior; creating a new panel is out of scope.
- The feature previews model files already stored in the project database; importing new models is out of scope.
- Model previews are read-only and intended for asset identification, not editing, measuring, or scene authoring.
- Formats that require unavailable external companion files may show a preview-unavailable state unless all required content is embedded in the project database.
- Browser-renderable model formats are sufficient for this version; specialized or proprietary formats may be recognized but can fall back clearly when not previewable.
- The local visuals engine is not required for the core preview in this feature.
- Typical embedded project models are expected to be small enough for an Inspector preview without blocking normal browsing workflows.
