# Tasks: Revert Saved Project

## Phase 1: Specification And Decision Policy

- [x] T001 Define clean, Discard, Cancel, failure, and Phoenix synchronization behavior.
- [x] T002 Document the atomic replacement design and same-handle reload boundary.
- [x] T003 Implement and test the pure Revert confirmation policy.

## Phase 2: Session And Menu Integration

- [x] T004 Add `DbSession.reload()` using the session's existing file handle.
- [x] T005 Add a regression proving reload reads disk and ignores unsaved in-memory mutations.
- [x] T006 Add `File > Revert`, its icon, action routing, and idle/open enablement.
- [x] T007 Require one explicit discard confirmation for dirty projects.
- [x] T008 Load and synchronize a temporary replacement before closing the current session.
- [x] T009 Atomically publish the replacement and clear session-bound selections, errors, loop state, clipboard ownership, and Undo history.
- [x] T010 Preserve the current session and dispose temporary state on reload or synchronization failure.
- [x] T011 Register offline replacements for synchronization on Phoenix reconnect.

## Phase 3: Validation

- [x] T012 Run focused Revert and database-session tests.
- [x] T013 Run TypeScript typecheck and changed-file lint.
- [x] T014 Run the complete unit suite.
- [x] T015 Run the production build and regenerate `dist`.
- [ ] T016 Validate Discard, Cancel, connected sync, offline pending sync, and failure preservation in a real browser.
