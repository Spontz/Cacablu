# Feature Specification: GLSL Editor Undo

**Feature Branch**: `018-glsl-editor-undo`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Preserve text undo across Save and make persisted GLSL saves reversible through application Undo.

## Runtime Context

**Browser Surface**: GLSL Monaco editor and Edit > Undo.  
**Local Engine Dependency**: Optional; restored enabled shaders are republished when Phoenix is connected.  
**Static Deployment Impact**: Uses existing browser editor, project database, and HTTP client only.  
**Real-Time Sensitivity**: Native text undo must remain immediate.  
**File System Access Requirement**: Required only for normal project save/open.

## User Scenarios & Testing

### User Story 1 - Undo Text After Saving (Priority: P1)

Users can press Ctrl/Cmd+Z after Save and recover earlier text as an unsaved editor state.

**Independent Test**: Edit, Save, edit again, and repeatedly undo in Monaco without consuming application history.

### User Story 2 - Undo A Persisted Shader Save (Priority: P1)

Users can invoke Edit > Undo to restore the exact database content that preceded the latest GLSL Save.

**Independent Test**: Save changed GLSL, invoke application Undo, and verify database bytes and open editor contents.

**Acceptance Scenarios**:

1. **Given** a changed shader Save succeeds, **When** application Undo runs, **Then** prior bytes and metadata are restored as one action.
2. **Given** Phoenix is connected, **When** persisted content is restored, **Then** the enabled shader is republished and failures appear in Events.
3. **Given** the project session or file is stale, **When** Undo runs, **Then** current project data remains untouched.

## Requirements

- **FR-001**: Monaco native undo history MUST survive a successful Save.
- **FR-002**: Ctrl/Cmd+Z in GLSL Monaco MUST use native model undo and MUST NOT consume application history.
- **FR-003**: Each changed successful Save MUST push exactly one immutable application Undo action.
- **FR-004**: Preview, unchanged content, and failed Save MUST push no application Undo action.
- **FR-005**: Application Undo MUST restore prior bytes, MIME type, format, and byte count only for the originating live session/file.
- **FR-006**: Restore MUST mark the project dirty and refresh the open editor without creating recursive history.
- **FR-007**: Connected restores MUST use the existing Phoenix asset-write path; remote failure MUST NOT roll back the local restore.
- **FR-008**: No Phoenix C++ or SQLite schema change is permitted.

## Success Criteria

- **SC-001**: Playwright proves native text undo works before and after Save.
- **SC-002**: Playwright proves Save followed by application Undo restores database and editor content.
- **SC-003**: Unit tests cover snapshot isolation, stale sessions, unchanged content, and write failure.
- **SC-004**: Typecheck, tests, lint, and build pass.

## Assumptions

- Application Undo intentionally does not add Redo.
