# Tasks: Absolute Time Editing For Multiple Bars

- [x] T001 Define absolute multi-bar start/end semantics in Spec Kit.
- [x] T002 Define atomic invalid-range and overlap rejection behavior.
- [x] T003 Implement a pure multi-bar time edit planner.
- [x] T004 Integrate absolute placements into Bar Editor Apply.
- [x] T005 Preserve one-action Undo and post-commit Phoenix sync.
- [x] T006 Test absolute Start Time while preserving individual ends.
- [x] T007 Test absolute End Time while preserving individual starts.
- [x] T008 Test both fields, no-op, negative/invalid ranges, selected-selected overlap, external overlap, and adjacency.
- [x] T009 Run typecheck, scoped lint, full tests, and production build.
- [ ] T010 Record validation and close the spec.

## Automated Validation

- Focused planner tests: 11 passed.
- Full unit suite: 29 files and 194 tests passed.
- TypeScript typecheck: passed.
- Scoped ESLint: passed.
- Production build: passed with only the existing Mantine directive and bundle-size warnings.
- Full Microsoft Edge Timeline/Pool Playwright regression: passed.

## Pending Manual Validation

- Select multiple worksessions, change only Start Time, and confirm every selected start equals the entered value while individual ends remain unchanged.
- Change only End Time and confirm every selected end equals the entered value while individual starts remain unchanged.
- Attempt an invalid or overlapping edit and confirm no selected worksession changes and Bar Editor records a warning.
- Undo one successful batch and confirm all prior ranges are restored together.
