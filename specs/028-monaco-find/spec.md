# Feature Specification: Monaco Text Search

**Feature Branch**: `028-monaco-find`  
**Created**: 2026-08-21  
**Status**: Implemented  
**Input**: User description: "Activar la búsqueda con Ctrl+F en los editores de texto Monaco que usa Cacablu."

## Runtime Context

**Browser Surface**: Section-script, GLSL asset, and CAM asset Monaco editors.  
**Local Engine Dependency**: None. Search is local to the active editor document.  
**Static Deployment Impact**: The feature runs entirely in the browser using the existing Monaco dependency and adds no backend or runtime service.  
**Real-Time Sensitivity**: Opening the search UI, updating matches, and navigating between them must feel immediate and must not interrupt typing.  
**File System Access Requirement**: None beyond the existing project open/save workflow.

## User Scenarios & Testing

### User Story 1 - Find Text In The Active Editor (Priority: P1)

As a user editing a section script, GLSL asset, or CAM asset, I want to press `Ctrl+F` and search within that document so that I can locate text without leaving Cacablu.

**Why this priority**: Opening an editor-local search and seeing its matches is the minimum useful workflow.

**Independent Test**: Focus each production Monaco editor, press `Ctrl+F`, enter a repeated query, and verify that the editor search UI opens and reports/highlights the matches in that document.

**Acceptance Scenarios**:

1. **Given** a section-script Monaco editor has focus, **When** the user presses `Ctrl+F`, **Then** Cacablu opens the editor's search UI and places keyboard focus in its query field instead of opening the browser page search.
2. **Given** a GLSL or CAM Monaco editor has focus, **When** the user presses `Ctrl+F`, **Then** the same editor-local search workflow opens.
3. **Given** the search UI is open, **When** the user enters or changes a query, **Then** all matches in the active document are highlighted and the current match and total match count are visible.
4. **Given** text is selected in the editor, **When** the user presses `Ctrl+F`, **Then** the search query is initialized from that selection when supported by the standard editor behavior.
5. **Given** focus is outside every Monaco editor, **When** the user presses `Ctrl+F`, **Then** Cacablu does not globally intercept the shortcut and the browser's normal behavior remains available.

---

### User Story 2 - Navigate And Close Search (Priority: P1)

As a user, I want to move through search results and close search using familiar keyboard controls so that I can inspect matches quickly and return to editing.

**Why this priority**: A search result list is only useful if the user can move predictably among matches and resume editing.

**Independent Test**: Search for text with multiple matches, navigate forward and backward through all matches, close the search UI, and verify that document content and Undo history remain unchanged.

**Acceptance Scenarios**:

1. **Given** a query has multiple matches, **When** the user activates next or previous match through the search UI or its standard keyboard controls, **Then** the editor selects and reveals the corresponding match and wraps at the document boundaries according to the editor's standard behavior.
2. **Given** the search UI is open, **When** the user presses `Escape` or uses its close control, **Then** the search UI closes and keyboard focus returns to the editor.
3. **Given** the user opens, changes, navigates, or closes a search, **When** the workflow completes, **Then** the document text, dirty state, save state, and Undo history are unchanged.

### Edge Cases

- An empty query shows no text matches and does not modify the document.
- A query with no matches remains visible with a zero-result indication and navigation does not move the text cursor unexpectedly.
- Queries may contain spaces, punctuation, non-ASCII characters, or text that resembles a regular expression; the enabled search options determine how they are interpreted.
- Search remains scoped to the active editor model and does not include other open tabs, project files, Timeline content, or Events.
- Reopening `Ctrl+F` while the search UI is already open focuses the existing query field rather than creating duplicate UI.
- Search highlighting must remain visually distinguishable from the existing selected-text occurrence highlighting and CAM column coloring.
- Replacing the active editor model or disposing its panel must not leave a detached search UI or shortcut handler.

## Requirements

### Functional Requirements

- **FR-001**: Every production Monaco text editor in Cacablu MUST provide editor-local search: section scripts, GLSL assets, and CAM assets.
- **FR-002**: Pressing `Ctrl+F` while a Monaco editor has focus MUST open and focus that editor's search UI and MUST prevent the browser page-search UI from handling that keystroke.
- **FR-003**: The platform-equivalent `Cmd+F` shortcut MUST provide the same behavior on macOS-supported browsers.
- **FR-004**: Pressing `Ctrl+F` or `Cmd+F` outside Monaco editors MUST NOT be intercepted globally by this feature.
- **FR-005**: Search MUST operate only on the complete active editor document and MUST highlight all matches while identifying the current match and total match count.
- **FR-006**: Users MUST be able to navigate to the next and previous match using the search UI and its standard keyboard controls, including standard boundary wrapping.
- **FR-007**: Users MUST be able to close search with `Escape` or its visible close control and resume editing with keyboard focus in the editor.
- **FR-008**: Search MUST support the existing editor search controls for match case, whole word, and regular-expression mode consistently across all three editor types.
- **FR-009**: Opening or using search MUST NOT change document content, project dirty state, save availability, or Undo history.
- **FR-010**: Search UI and match highlighting MUST coexist legibly with syntax coloring, selection-occurrence highlighting, current selection, and CAM column decorations.
- **FR-011**: Repeated activation MUST reuse the editor's current search UI, and editor disposal or model replacement MUST clean up search state belonging to the old surface.
- **FR-012**: The feature MUST use the existing Monaco runtime, preserve static browser-only deployment, and add no Phoenix, WebSocket, database, filesystem, or new runtime-dependency requirement.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In manual browser validation, `Ctrl+F` opens editor-local search in 100% of the three production Monaco editor types and never opens browser page search while those editors have focus.
- **SC-002**: Automated browser tests verify open, query, match count, forward/backward navigation, wrapping, close, and focus restoration in section-script, GLSL, and CAM editors.
- **SC-003**: Searches covering no match, one match, repeated matches, punctuation, non-ASCII text, case sensitivity, whole-word mode, and regular-expression mode return the expected results without modifying source text.
- **SC-004**: Search operations produce zero changes to document value, project dirty state, Save availability, and editor/application Undo history.
- **SC-005**: Manual visual validation confirms that search UI and highlights remain readable alongside syntax, occurrence, selection, and CAM column decorations.
- **SC-006**: Typecheck, focused tests, lint for changed code, and production build pass without new errors.

## Assumptions

- "Los editores de texto Monaco" refers to all current production Monaco surfaces: section scripts, GLSL assets, and CAM assets.
- Search is confined to the active document; project-wide or cross-file search is outside scope.
- The standard Monaco search experience is desired, including its match-case, whole-word, regular-expression, navigation, wrapping, and close behavior.
- Search-and-replace, `Ctrl+H`, persistent search history across sessions, and new application menu commands are outside scope.
- Windows/Linux `Ctrl+F` is the requested path; `Cmd+F` is included as its normal platform equivalent without broadening the feature into additional platform-specific behavior.
