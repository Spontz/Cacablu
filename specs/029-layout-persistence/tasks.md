# Tasks: Persistent Workspace Layout

## Phase 1: Specification And Storage Boundary

- [x] T001 Define restore, automatic persistence, project-opening, and recovery behavior in `spec.md`.
- [x] T002 Define the Dockview lifecycle integration and versioning strategy in `plan.md`.
- [x] T003 Implement versioned, exception-safe browser storage helpers in `src/layout/workspace-layout-storage.ts`.
- [x] T004 Add unit coverage for round trips, missing entries, invalid JSON/version/payload, and unavailable storage.

## Phase 2: Workspace Integration

- [x] T005 Restore a valid saved layout during Dockview workspace mount.
- [x] T006 Persist `dockview.toJSON()` for every aggregate Dockview layout-change notification.
- [x] T007 Invalidate an entry and fall back if Dockview rejects the restored payload.
- [x] T008 Ensure Reset Layout persists an intentionally empty preference.
- [x] T009 Expose whether a layout preference exists so project initialization can distinguish first run from a restored empty layout.

## Phase 3: Project Lifecycle

- [x] T010 Keep established workspace panels mounted while a project session changes.
- [x] T011 Open legacy Timeline and Pool defaults only when no saved or current-session layout preference exists.

## Phase 4: Validation

- [x] T012 Add a real-browser Dockview save/reconstruction/corrupt-data regression.
- [x] T013 Run focused tests and changed-file lint.
- [x] T014 Run the complete unit suite and TypeScript typecheck.
- [x] T015 Run the production build and regenerate the static `dist` artifact.
