# Feature Specification: Text Selection Occurrence Highlighting

**Feature Branch**: `019-text-selection-highlighting`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Highlight every exact occurrence of selected text in Cacablu text editors.

## Runtime Context

**Browser Surface**: Section-script and GLSL Monaco editors.  
**Local Engine Dependency**: None.  
**Static Deployment Impact**: Browser-only Monaco decorations and CSS.  
**Real-Time Sensitivity**: Selection and content changes must refresh highlights immediately without blocking typing.  
**File System Access Requirement**: None beyond normal project workflows.

## User Scenarios & Testing

### User Story 1 - Find Repeated Text By Selecting It (Priority: P1)

Selecting an identifier, path, constant, or expression visibly marks every other exact occurrence in the loaded document.

**Independent Test**: Select repeated literal text in each production Monaco editor and verify secondary matches, then clear selection.

**Acceptance Scenarios**:

1. **Given** repeated text in the current document, **When** a non-empty selection is made, **Then** every other literal case-sensitive match is highlighted.
2. **Given** active matches, **When** selection becomes empty/whitespace or the model changes, **Then** secondary decorations clear.
3. **Given** selected text contains punctuation or multiple words, **When** matches exist, **Then** literal matching includes them without creating cursors or editing text.

## Requirements

- **FR-001**: Both section-script and GLSL editors MUST install the same occurrence-highlighting behavior.
- **FR-002**: Matching MUST be literal, case-sensitive, and local to the active model.
- **FR-003**: The primary selection MUST retain its normal style and MUST be excluded from secondary decorations.
- **FR-004**: Empty and whitespace-only selections MUST produce no secondary highlights.
- **FR-005**: Highlights MUST recompute after selection and content changes and clear on disposal/model replacement.
- **FR-006**: Results MUST be capped to prevent unbounded decoration work.
- **FR-007**: Secondary style MUST remain distinct from the primary selection and preserve syntax readability.
- **FR-008**: Highlighting MUST NOT modify text, create extra cursors, or alter Undo history.

## Success Criteria

- **SC-001**: Browser tests pass in both production editors for show, update, and clear behavior.
- **SC-002**: Unit tests cover whitespace, punctuation, case sensitivity, cap, and primary exclusion.
- **SC-003**: Typecheck, tests, lint, and build pass without Phoenix/database changes.

## Assumptions

- Semantic symbol references and cross-file search remain outside scope.
