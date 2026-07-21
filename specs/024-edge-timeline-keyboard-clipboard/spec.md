# Feature Specification: Reliable Timeline Keyboard Clipboard In Edge

**Feature Branch**: `024-edge-timeline-keyboard-clipboard`  
**Created**: 2026-07-21  
**Status**: Complete  

## User Story 1 - Copy And Repeatedly Paste Bars With The Keyboard (Priority: P1)

As a Timeline editor using Microsoft Edge, I want `Ctrl+C` and `Ctrl+V` to copy a selected bar and paste independent copies at the selected Timeline targets without requiring a previous drag or Shift gesture.

### Acceptance Scenarios

1. **Given** one or more Timeline bars are selected, **When** the user presses `Ctrl+C`, **Then** Cacablu publishes a self-contained bar payload to the system clipboard even if Edge does not subsequently dispatch its implicit native Copy event to the focused Timeline element.
2. **Given** a bar payload was copied, **When** the user clicks an empty layer/time target and presses `Ctrl+V`, **Then** Cacablu creates a new independent bar batch at that target.
3. **Given** one Paste succeeded, **When** the user selects another valid target and presses `Ctrl+V` again, **Then** Cacablu creates another independent batch without consuming the clipboard payload.
4. **Given** the source and destination are different tabs with different projects, **When** Copy and Paste are invoked with the keyboard, **Then** the destination receives the complete bar payload through the system clipboard.
5. **Given** focus is inside an input, textarea, contenteditable element, or Monaco editor, **When** the user uses clipboard shortcuts, **Then** native text editing retains precedence.

## User Story 2 - Equivalent Menu And Keyboard Semantics (Priority: P1)

As an editor, I want menu and keyboard Copy/Paste to use the same payload capture, validation, context routing, and reusable clipboard semantics.

### Acceptance Scenarios

1. **Given** the same bar selection, **When** Copy is invoked from the menu or with `Ctrl+C`, **Then** both routes publish the same Cacablu formats and update the same reusable snapshot.
2. **Given** asynchronous clipboard permission is unavailable, **When** keyboard Copy/Paste uses trusted user gestures, **Then** it remains functional without a pre-granted Clipboard API permission.
3. **Given** an operation cannot be completed, **When** Cacablu handles it, **Then** Events distinguishes an empty selection, missing Timeline target, invalid payload, context mismatch, and browser clipboard failure.

## Requirements

- **FR-001**: Timeline `Ctrl+C` MUST explicitly publish the selected bar snapshot during the keyboard user gesture and MUST NOT depend solely on Edge's later implicit Copy routing.
- **FR-002**: Keyboard and menu Copy MUST share the same bar envelope encoder and system clipboard writer.
- **FR-003**: Timeline `Ctrl+V` MUST accept the native `ClipboardEvent` payload without requiring `navigator.clipboard.read()` permission.
- **FR-004**: A copied payload MUST remain reusable for repeated Paste operations.
- **FR-005**: Clipboard shortcuts MUST preserve native text/editor behavior for editable targets.
- **FR-006**: Browser validation MUST run in Microsoft Edge without pre-granting clipboard permissions and MUST reproduce the literal bar click, `Ctrl+C`, empty-lane click, `Ctrl+V` sequence.

## Success Criteria

- **SC-001**: The literal same-project keyboard sequence succeeds twice consecutively in Edge without a Shift gesture.
- **SC-002**: Cross-tab keyboard Copy/Paste succeeds between different loaded projects.
- **SC-003**: No-permission Edge validation, unit tests, typecheck, lint for changed files, and production build pass.
