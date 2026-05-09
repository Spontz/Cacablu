# Feature Specification: Playback Engine Data Export

**Feature Branch**: `009-playback-engine-data`  
**Created**: 2026-05-09  
**Status**: Closed  
**Input**: User description: "Cuando el sistema se inicializa, los botones de reproduccion esten desactivados. Cuando cargamos el archivo sqlite, se activara solo el boton de PLAY. Cuando el usuario pulse el boton de PLAY, el navegador debe preguntar al usuario donde esta el motor de visualizacion, y tras escoger la carpeta del ejecutable, vamos a crear una carpeta data dentro de esa carpeta, dentro otra llamada pool, y dentro de pool los archivos contenidos en el sqlite, con su jerarquia de carpetas y respetando los nombres. Ademas, dentro de data se creara un archivo .spo por cada barra o seccion de la demo. Si ya existe una carpeta data se borrara antes de escribir la nueva. Tambien se creara dentro de data una carpeta config con graphics.spo, loader.spo y control.spo generados desde la tabla variables y FBOs cuando corresponda. La carpeta resources de la carpeta autorizada debe copiarse dentro de data con el mismo nombre y contenido."

## Runtime Context *(mandatory)*

**Browser Surface**: The main application shell, specifically the timeline transport controls and resource tree workflow.  
**Local Engine Dependency**: Playback handoff depends on the user identifying the local visualization engine location, but the app must still initialize and load project files without the engine being selected.  
**Static Deployment Impact**: The workflow must remain usable from the packaged static app opened locally, with any browser permission prompts handled in-page and without a backend service.  
**Real-Time Sensitivity**: Transport control state changes and user feedback must be immediate enough that users can trust whether playback is available.  
**File System Access Requirement**: The feature requires browser-supported folder selection and write permission so the app can create or update a `data/pool` folder tree in the selected engine folder.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gate Playback Until Project Load (Priority: P1)

As a user, I want playback controls to reflect whether a project is ready so that I cannot start playback before a SQLite project has been loaded.

**Why this priority**: This prevents invalid playback attempts and gives the user a clear next step when the app first opens.

**Independent Test**: Open the app without a project, inspect the transport controls, then load a valid SQLite project and confirm only Play becomes available.

**Acceptance Scenarios**:

1. **Given** the app has just initialized and no project is loaded, **When** the user views the transport controls, **Then** all playback controls are disabled.
2. **Given** no project is loaded, **When** the user attempts to interact with playback controls, **Then** no playback action starts and the controls remain disabled.
3. **Given** a valid SQLite project has loaded successfully, **When** the resource tree is available, **Then** only the Play control becomes enabled and the other playback controls remain disabled.

---

### User Story 2 - Choose Visualization Engine on Play (Priority: P2)

As a user, I want Play to ask me where the visualization engine executable lives so that the app can prepare the engine folder before playback begins.

**Why this priority**: Playback cannot proceed without a target engine folder, and the location is user-specific.

**Independent Test**: Load a valid project, press Play, and confirm the browser asks for a folder location before any data folders or files are written.

**Acceptance Scenarios**:

1. **Given** a valid project is loaded and Play is enabled, **When** the user presses Play, **Then** the browser prompts the user to choose the visualization engine folder.
2. **Given** the folder prompt is shown, **When** the user cancels the selection, **Then** no `data` folder is created and Play remains available for another attempt.
3. **Given** the selected folder cannot be written to, **When** the app attempts to prepare playback, **Then** the user sees a clear non-blocking error and no partial success is reported.

---

### User Story 3 - Export Resource Tree Structure (Priority: P3)

As a user, I want the selected engine folder to receive a `data/pool` folder tree containing the project's resource files so that the visualization engine can read the project's file organization directly from disk.

**Why this priority**: The engine needs a project data handoff that mirrors the resources currently shown to the user.

**Independent Test**: Load a project with folders and files in the resource tree, press Play, choose a writable engine folder, and inspect the generated `data/pool` directory.

**Acceptance Scenarios**:

1. **Given** a project with a populated resource tree is loaded, **When** the user selects a writable engine folder after pressing Play, **Then** a folder named `data` is created in that folder and contains a folder named `pool`.
2. **Given** the resource tree contains nested folders and files, **When** `data/pool` is created, **Then** it preserves the visible folder hierarchy and writes the SQLite file contents using the original resource names.
3. **Given** the SQLite project contains demo bars or sections, **When** `data` is created, **Then** one `.spo` file is created in `data` for each bar using the filename `<bar id>-<bar type>.spo`.
4. **Given** a `data` folder already exists, **When** the export starts, **Then** the existing `data` folder is deleted before the new `data` folder is written.
5. **Given** the SQLite project contains graphics variables and FBO records, **When** the export completes, **Then** `data/config/graphics.spo` contains the `gl_` lines followed by FBO configuration blocks.
6. **Given** the selected engine folder contains a `resources` folder, **When** the export completes, **Then** that folder is copied recursively to `data/resources`.
7. **Given** the SQLite project contains `loaderCode` and control variables, **When** the export completes, **Then** `data/config/loader.spo` and `data/config/control.spo` are created next to `graphics.spo`.
8. **Given** the export completes successfully, **When** the user returns to the app, **Then** the UI reports that the engine data pool, section files, resources, and config were prepared.

---

### Edge Cases

- What happens when the user loads an invalid, empty, or unsupported SQLite file?
- What happens when a project loads but the resource tree has no files?
- What happens when the browser does not support folder selection or local file writes?
- What happens when the user selects the wrong folder or a folder without the visualization engine executable?
- What happens when the selected folder contains an existing file named `data` instead of a folder?
- What happens when resources have duplicate names in different folders?
- What happens when resource names contain spaces, accents, symbols, or path separator characters?
- What happens when the project is changed after a successful export and the user presses Play again?
- What happens when a bar type is empty or contains characters unsupported by the local filesystem?
- What happens when an FBO uses explicit width and height instead of ratio?
- What happens when the selected engine folder does not contain a `resources` folder?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST initialize with all playback controls disabled when no SQLite project is loaded.
- **FR-002**: The system MUST enable only the Play control after a SQLite project loads successfully and the resource tree can be represented.
- **FR-003**: The system MUST keep non-Play transport controls disabled until a separate feature defines their active playback behavior.
- **FR-004**: The system MUST prompt the user to choose the visualization engine folder when Play is pressed for the first playback preparation attempt of a loaded project.
- **FR-005**: The system MUST allow the user to cancel folder selection without creating or modifying files.
- **FR-006**: The system MUST create or reuse a folder named `data` inside the selected engine folder after the user grants access.
- **FR-007**: The system MUST create or reuse a folder named `pool` inside the `data` folder.
- **FR-008**: The `data/pool` directory MUST represent the same folder hierarchy currently displayed in the resource tree.
- **FR-009**: The system MUST write the SQLite resource file contents into `data/pool`, preserving each file's resource name and folder position.
- **FR-010**: The system MUST delete any existing `data` folder in the selected engine folder before writing the new export.
- **FR-011**: The system MUST create one `.spo` file directly inside `data` for each SQLite bar or section.
- **FR-012**: Each `.spo` filename MUST follow `<bar id>-<bar type>.spo`, using `section` as the type when the bar type is empty.
- **FR-013**: Each `.spo` file MUST contain the section command header, id, start, end, enabled flag, layer, blend mode, blend equation, one blank line, and the section text.
- **FR-014**: The system MUST create or replace a folder named `config` inside `data`.
- **FR-015**: The system MUST create `data/config/graphics.spo` using `fullScreen`, `screenWidth`, `screenHeight`, and `vsync` from the SQLite `variables` table, writing them as `gl_fullscreen`, `gl_width`, `gl_height`, and `gl_vsync`; `gl_aspect` MUST be calculated from `screenWidth / screenHeight`.
- **FR-016**: Each FBO block MUST include ratio when no explicit size is present, or width and height when explicit size is present, followed by format and color attachment count, using `fbo_<id minus 1>` as the output prefix.
- **FR-017**: The system MUST copy the selected engine folder's `resources` folder recursively into `data/resources`.
- **FR-018**: The system MUST report success after the `data/pool` directory, resource files, `.spo` section files, `data/resources`, and all config `.spo` files have been created.
- **FR-019**: The system MUST report a clear error when folder selection, permission, folder creation, deletion, reading `resources`, or file writing fails.
- **FR-020**: The system MUST avoid starting playback or reporting playback as active until `data` has been prepared successfully.
- **FR-021**: The system MUST preserve static deployment with no backend dependency.
- **FR-022**: The system MUST require browser support for folder selection and local file writing or provide a documented fallback that preserves the user's ability to create the export directories.
- **FR-023**: The system MUST create `data/config/loader.spo` by writing a `:::loading` header followed by the `loaderCode` value from the SQLite `variables` table, without duplicating the header if it is already present.
- **FR-024**: The system MUST create `data/config/control.spo` with `demo_name` from `demoName`, `loop` from `demoLoop`, `demo_start` from `startTime`, and `demo_end` from `endTime`.
- **FR-025**: The system MUST write `debug 1`, `sound 1`, `slave 1`, `debugEnableAxis 1`, and `debugEnableFloor 1` in `control.spo` regardless of database values.

### Key Entities *(include if feature involves data)*

- **Playback Control State**: The enabled or disabled state of each transport control based on app initialization, project loading, and playback preparation.
- **Loaded Project**: The SQLite project currently open in the app, including the resources visible in the resource tree.
- **Visualization Engine Folder**: The user-selected local folder that contains or represents the location of the visualization engine executable.
- **Resource Tree Structure**: The folders and files shown in the Pool panel, including nesting, display names, item types, and stable identities.
- **Engine Data Pool**: The `data/pool` folder tree written into the visualization engine folder to hand off the current project resource files.
- **Section File**: A `.spo` file in `data` generated from one SQLite bar or section.
- **Graphics Config File**: The `data/config/graphics.spo` file generated from the SQLite `variables` table and FBOs.
- **Loader Config File**: The `data/config/loader.spo` file generated from the SQLite `loaderCode` variable.
- **Control Config File**: The `data/config/control.spo` file generated from selected SQLite variables plus fixed playback/debug flags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On initial app load, 100% of playback controls are disabled before any project is opened.
- **SC-002**: After a valid SQLite project loads, Play becomes enabled within 500 ms while all other playback controls remain disabled.
- **SC-003**: In a supported browser, a user can press Play, select a writable engine folder, and produce the `data/pool` folder tree in under 30 seconds after project load.
- **SC-004**: For a project containing at least 3 folder levels and 20 resources, the generated `data/pool` tree preserves 100% of the visible resource tree hierarchy and file names.
- **SC-005**: Cancelled folder selection produces no new or modified `data/pool` content in 100% of manual validation attempts.
- **SC-006**: Permission or write failures show a user-visible error without freezing the shell in 100% of validation attempts.
- **SC-007**: Standard project checks for the feature pass with no new lint, test, or build errors.

## Assumptions

- The `data` and `pool` folder names are exact.
- The selected folder is the folder that should receive the `data/pool` tree, even if executable validation is limited in the first version.
- Files under `data/pool` contain the binary contents stored in the SQLite `files` table.
- If the same project remains loaded, the app may reuse a previously granted folder permission where the browser allows it.
- Browser support for local folder selection and writing is required for the primary workflow.
- The feature prepares engine data for playback; launching the visualization engine process itself is outside this feature unless added in a later spec.
