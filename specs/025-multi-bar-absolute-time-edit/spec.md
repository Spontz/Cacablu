# Feature Specification: Absolute Time Editing For Multiple Bars

**Feature Branch**: `025-multi-bar-absolute-time-edit`  
**Created**: 2026-07-21  
**Status**: In progress  

## User Story 1 - Assign One Start Time To Selected Bars (Priority: P1)

As a Timeline editor, I want Start Time in Bar Editor to assign the entered value to every selected bar so that I can align several worksessions at an exact time.

### Acceptance Scenarios

1. **Given** multiple selected bars with different starts, **When** the user changes only Start Time to `T` and applies, **Then** every selected bar starts exactly at `T` and retains its own previous end time.
2. **Given** the requested common start would make any selected bar end at or before its start, **When** Apply is pressed, **Then** no selected bar changes and Cacablu reports an invalid range.
3. **Given** the requested common start would overlap another bar on the same layer, **When** Apply is pressed, **Then** the complete batch is rejected and Cacablu reports the conflict.

## User Story 2 - Assign One End Time To Selected Bars (Priority: P1)

As a Timeline editor, I want End Time in Bar Editor to assign the entered value to every selected bar while retaining their individual starts.

### Acceptance Scenarios

1. **Given** multiple selected bars with different ends, **When** the user changes only End Time to `T` and applies, **Then** every selected bar ends exactly at `T` and retains its own previous start time.
2. **Given** the requested common end would make any selected bar invalid or cause an overlap, **When** Apply is pressed, **Then** the complete batch is rejected without persistence, Undo entry, or Phoenix sync.

## User Story 3 - Apply And Undo An Atomic Time Batch (Priority: P1)

As an editor, I want a valid multi-bar time edit to behave as one atomic action so I can undo it safely.

### Acceptance Scenarios

1. **Given** both Start Time and End Time were changed, **When** the range is valid for every selected bar, **Then** all selected bars receive exactly those two values.
2. **Given** a valid batch is applied, **When** Undo is invoked, **Then** every affected bar regains its exact prior start and end as one action.
3. **Given** Phoenix is connected, **When** a valid batch commits locally, **Then** existing per-bar synchronization runs only after the complete local batch is applied.

## Requirements

- **FR-001**: Changing multi-selection Start Time MUST assign that exact value to every selected bar.
- **FR-002**: Changing multi-selection End Time MUST assign that exact value to every selected bar.
- **FR-003**: A time field that the user did not change MUST preserve each selected bar's individual value.
- **FR-004**: Changing both fields MUST assign the exact requested start and end to every selected bar.
- **FR-005**: Proposed starts MUST be finite and non-negative, and every proposed end MUST be finite and greater than its corresponding start.
- **FR-006**: Cacablu MUST validate the complete proposed project placement, including conflicts among selected bars and with unselected bars on the same layer, before persistence.
- **FR-007**: Any invalid range or overlap MUST reject the complete batch without partial memory/DB mutation, Undo entry, Timeline refresh, or Phoenix sync.
- **FR-008**: Rejection MUST create a clear Bar Editor warning distinguishing invalid ranges from overlap conflicts.
- **FR-009**: A successful batch MUST retain the existing one-action Undo and post-commit Phoenix synchronization behavior.

## Success Criteria

- **SC-001**: Unit tests prove 100% of selected starts or ends equal the requested changed value.
- **SC-002**: Tests prove unedited endpoints remain unchanged per bar.
- **SC-003**: Invalid and overlapping batches produce zero proposed mutations.
- **SC-004**: Typecheck, scoped lint, full unit tests, and production build pass.

