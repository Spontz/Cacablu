# Feature Specification: Command Menu Icons

**Feature Branch**: `021-command-menu-icons`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Add small icons before command text inside Cacablu menus while keeping the menu bar text-only.

## Runtime Context

**Browser Surface**: Main menu popups and Pool action menus.  
**Local Engine Dependency**: None.  
**Static Deployment Impact**: Dependency-free inline SVG and CSS only.  
**Real-Time Sensitivity**: Negligible; icons are created with menu DOM.  
**File System Access Requirement**: None.

## User Scenarios & Testing

### User Story 1 - Scan Menu Commands Quickly (Priority: P1)

Every application-controlled popup command shows a small recognizable icon before its unchanged text.

**Independent Test**: Open File, Edit, Timeline, Panels, and Pool menus and verify every actionable item has an icon while labels, shortcuts, separators, and clicks remain unchanged.

**Acceptance Scenarios**:

1. **Given** a main popup menu, **When** commands render, **Then** every non-separator command has a decorative icon before its label.
2. **Given** a Pool action menu, **When** it renders, **Then** every actionable item has an icon and existing separators/order remain unchanged.
3. **Given** the top menu bar, **When** it renders, **Then** File, Edit, Timeline, and Panels remain text-only.

## Requirements

- **FR-001**: One dependency-free SVG factory MUST supply shared menu icons and a neutral fallback.
- **FR-002**: Every current main-popup and Pool command MUST have an explicit glyph mapping.
- **FR-003**: Icons MUST precede visible labels and use compact consistent size, stroke, and alignment.
- **FR-004**: Icons MUST be `aria-hidden`, non-focusable, and MUST NOT replace visible text.
- **FR-005**: Labels, shortcuts, disabled states, action order, separators, accessible command behavior, and clicks MUST remain unchanged.
- **FR-006**: File, Edit, Timeline, and Panels menu-bar triggers MUST contain no decorative command icons.
- **FR-007**: Monaco native context menus and autocomplete/value suggestion lists are outside scope.

## Success Criteria

- **SC-001**: Browser tests find mapped decorative icons for all current popup commands and Pool actions.
- **SC-002**: Browser tests find zero icons in the four menu-bar triggers and prove commands still execute.
- **SC-003**: Typecheck, lint, build, and visual validation pass without a new dependency.

## Assumptions

- Icons supplement text; they are not intended to communicate commands independently.
