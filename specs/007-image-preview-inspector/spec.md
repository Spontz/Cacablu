# Feature Specification: Image Preview in Inspector

**Feature Branch**: `007-image-preview-inspector`  
**Created**: 2026-05-05  
**Status**: Complete  
**Input**: User description: "mostrar la previsualizacion de las imagenes seleccionadas en el explorador de archivos, en el panel de inspeccion"

## Runtime Context *(mandatory)*

**Browser Surface**: The Resources file explorer and the Inspector panel inside the same project window; selecting an image file in Resources updates the Inspector panel for that project only  
**Local Engine Dependency**: The feature does not require the local visuals engine; it reads image asset content from the in-memory project database session already owned by the project window  
**Static Deployment Impact**: The feature must remain fully usable in a static browser application with no backend or server dependency  
**Real-Time Sensitivity**: The Inspector panel must update promptly when the user changes the selected file, with no noticeable delay for typical embedded project images  
**File System Access Requirement**: The feature does not access the file system directly; it uses the file entries already loaded from the project database

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview Selected Image (Priority: P1)

As a user, I want the Inspector panel to show a preview of the image file I select in the Resources file explorer so that I can identify visual assets without opening a separate tool.

**Why this priority**: The image preview is the primary value of the feature; without it selection in the file explorer does not help users inspect visual content.

**Independent Test**: Open a project containing at least one image file, select that image in the Resources file explorer, and confirm that the Inspector panel displays the selected image preview.

**Acceptance Scenarios**:

1. **Given** a project is open and the Resources file explorer lists an image file, **When** the user selects that image file, **Then** the Inspector panel shows a preview of that image.
2. **Given** an image preview is visible, **When** the user selects a different image file, **Then** the Inspector panel replaces the preview with the newly selected image.
3. **Given** an image file is selected, **When** the Inspector panel is visible, **Then** the preview is clearly associated with the selected file name.

---

### User Story 2 - Handle Non-Image Selection (Priority: P1)

As a user, I want the Inspector panel to avoid showing stale image previews when I select folders or non-image files so that the panel always reflects my current selection.

**Why this priority**: A stale preview would mislead users about what is selected, making the inspector unreliable.

**Independent Test**: Select an image to show a preview, then select a folder or non-image file and confirm that the Inspector panel changes to a non-image state for the current selection.

**Acceptance Scenarios**:

1. **Given** an image preview is visible, **When** the user selects a folder, **Then** the Inspector panel clears the image preview and shows folder selection details or a neutral non-preview state.
2. **Given** an image preview is visible, **When** the user selects a non-image file, **Then** the Inspector panel clears the image preview and indicates that no image preview is available for the current file.
3. **Given** no file is selected, **When** the Inspector panel renders, **Then** it shows a neutral empty-selection state rather than an image preview.

---

### User Story 3 - Preserve Project Isolation (Priority: P2)

As a user working with multiple project windows, I want each window's Inspector panel to preview only the file selected in that same window so that assets from different projects are never mixed.

**Why this priority**: The application treats each database as an independent project window, and inspector state must follow that boundary.

**Independent Test**: Open two projects in separate project windows, select different files in each Resources panel, and confirm that each Inspector panel reflects only its own window's selection.

**Acceptance Scenarios**:

1. **Given** two project windows are open, **When** the user selects an image in the first window's Resources panel, **Then** only the first window's Inspector panel shows that image preview.
2. **Given** two project windows are open with different selections, **When** the user switches between windows, **Then** each Inspector panel preserves the preview or empty state for its own project.
3. **Given** a project window is closed, **When** it is removed, **Then** its selected-file and preview state are discarded without affecting other open project windows.

---

### User Story 4 - Communicate Preview Problems (Priority: P3)

As a user, I want the Inspector panel to show a clear fallback when a selected image cannot be previewed so that I understand the issue instead of seeing a broken or blank panel.

**Why this priority**: Broken or unsupported image data is not the main flow, but the panel must fail clearly when it occurs.

**Independent Test**: Select an image-like file with missing, unsupported, or invalid image content and confirm that the Inspector panel shows a clear fallback state.

**Acceptance Scenarios**:

1. **Given** a selected file has an image type but no readable image content, **When** the Inspector panel updates, **Then** it shows a clear "preview unavailable" state for that file.
2. **Given** a selected file has unsupported image content, **When** the Inspector panel attempts to preview it, **Then** it avoids showing a broken image and displays a fallback state.
3. **Given** a very large image is selected, **When** the preview appears, **Then** it fits within the Inspector panel without overflowing or distorting the panel layout.

### Edge Cases

- What happens when the selected image file has missing or empty binary content?
- What happens when the selected file has an image-like type but the content cannot be decoded as an image?
- What happens when a supported image has very large dimensions?
- What happens when an image is selected and then the project window is closed?
- What happens when the Inspector panel is hidden or resized while an image is selected?
- What happens when the user rapidly changes selection across multiple files?
- What happens when the selected file has a null, empty, or duplicate name?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Resources file explorer MUST expose a single current selection for the project window when the user selects a folder or file.
- **FR-002**: Selecting an image file in the Resources file explorer MUST update the Inspector panel in the same project window with a preview of that image.
- **FR-003**: The Inspector panel MUST display the selected image in a way that preserves its visual proportions and fits within the available panel space.
- **FR-004**: The Inspector panel MUST show the selected file name with the image preview so users can confirm which asset they are inspecting.
- **FR-005**: Selecting a different image file MUST replace the previous preview with the new selected image.
- **FR-006**: Selecting a folder, non-image file, or no item MUST clear any previous image preview and show an appropriate current-selection state.
- **FR-007**: The system MUST recognize common browser-previewable image assets by their stored file type or name, including PNG, JPEG, GIF, WebP, BMP, and SVG.
- **FR-008**: If an image file cannot be previewed because its content is missing, invalid, or unsupported, the Inspector panel MUST show a clear preview-unavailable state instead of a stale or broken image.
- **FR-009**: The preview MUST be read-only; users MUST NOT be able to edit, rename, delete, or move the selected asset through this feature.
- **FR-010**: Each project window MUST keep its Resources selection and Inspector preview isolated from every other project window.
- **FR-011**: The preview behavior MUST remain part of the static deployable application with no backend dependency.
- **FR-012**: The Inspector panel MUST remain usable when resized, with image previews constrained to the panel bounds.

### Key Entities *(include if feature involves data)*

- **Resource Selection**: The currently selected folder or file in a project window's Resources file explorer; it determines what the Inspector panel displays.
- **Image File**: A file entry from the project database whose stored type or name identifies it as a browser-previewable image asset and whose content may be rendered as a visual preview.
- **Inspector Preview State**: The Inspector panel's current display state for the project window, such as empty selection, folder selection, non-image file selection, image preview, or preview unavailable.
- **Project Window**: A self-contained workspace window for one open database file; it owns its Resources selection and Inspector preview exclusively.
- **Database Session**: The in-memory database owned by a project window; image preview data is read from this session and not from direct file system access.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a previewable image from the Resources file explorer and see the corresponding preview in the Inspector panel in under 1 second for typical project images.
- **SC-002**: In manual validation, selecting a folder or non-image file after previewing an image clears the previous preview 100% of the time.
- **SC-003**: In manual validation with two open project windows, each Inspector panel shows only the selection from its own Resources file explorer.
- **SC-004**: At least six common image types (PNG, JPEG, GIF, WebP, BMP, SVG) are either previewed successfully when valid or produce a clear preview-unavailable state when invalid.
- **SC-005**: Image previews fit within the Inspector panel at common desktop panel sizes without overflowing, cropping unintentionally, or distorting aspect ratio.
- **SC-006**: Project lint, typecheck, and build checks complete without new errors for this feature.

## Assumptions

- This feature builds on the existing Resources file explorer and Inspector panel; creating a new panel is out of scope.
- The feature previews image files already stored in the project database; importing new images is out of scope.
- The Inspector panel may show minimal metadata for non-image selections, but detailed metadata editing is out of scope.
- Browser-previewable formats are sufficient for this version; specialized image formats that require custom decoders are out of scope.
- The Resources file explorer remains read-only, matching the current project file explorer scope.
- Typical embedded project images are small enough to preview directly in the browser without a dedicated thumbnail cache in this first version.
