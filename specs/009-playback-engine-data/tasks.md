# Tasks: Playback Engine Data Export

**Input**: Design documents from `/specs/009-playback-engine-data/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup

- [X] T001 Verify existing ignore/tooling setup for TypeScript/Vite project in `.gitignore` and `eslint.config.js`

---

## Phase 2: Foundational

- [X] T002 [P] Add resource tree unit tests in `tests/unit/resource-tree.test.ts`
- [X] T003 [P] Add engine data export unit tests in `tests/unit/engine-data-export.test.ts`
- [X] T004 Create shared resource tree model and serializer in `src/resources/resource-tree.ts`
- [X] T005 Create engine data export service in `src/services/engine-data-export.ts`
- [X] T006 Refactor Pool panel to use shared resource tree model in `src/panels/resources-panel.ts`

---

## Phase 3: User Story 1 - Gate Playback Until Project Load (Priority: P1)

**Goal**: All transport controls disabled at startup; after valid SQLite load, only Play enabled.

**Independent Validation**: Open app with no project, inspect controls, then load a project and confirm only Play is enabled.

- [X] T007 [US1] Add transport readiness rendering and disabled button state in `src/panels/timeline-panel.ts`
- [X] T008 [US1] Ensure database clear/open transitions reset transport state in `src/panels/timeline-panel.ts`

---

## Phase 4: User Story 2 - Choose Visualization Engine on Play (Priority: P2)

**Goal**: Pressing Play asks for the engine folder and handles cancel/failure without starting playback.

**Independent Validation**: Load a project, press Play, cancel folder picker, confirm no data folder is created and Play stays available.

- [X] T009 [US2] Integrate Play action with engine folder picker/export service in `src/panels/timeline-panel.ts`
- [X] T010 [US2] Add user-visible preparation status and error messages in `src/panels/timeline-panel.ts`

---

## Phase 5: User Story 3 - Export Resource Tree Structure (Priority: P3)

**Goal**: Selected engine folder receives a `data/pool` directory containing SQLite resource files matching the visible resource tree hierarchy.

**Independent Validation**: Load a project with nested resources, press Play, select folder, inspect generated `data`.

- [X] T011 [US3] Ensure exported `data/pool` directory matches contract in `src/services/engine-data-export.ts`
- [X] T012 [US3] Confirm duplicate names and nested paths are represented deterministically in `src/resources/resource-tree.ts`

---

## Phase 6: Polish & Validation

- [X] T013 Run `npm test`
- [X] T014 Run `npm run lint`
- [X] T015 Run `npm run build`
- [X] T016 Review quickstart/manual browser validation steps in `specs/009-playback-engine-data/quickstart.md`

---

## Dependencies & Execution Order

- Setup: T001
- Foundational: T002-T006 before user stories
- US1: T007-T008
- US2: T009-T010 depends on foundational and US1 transport state
- US3: T011-T012 depends on foundational export contract
- Polish: T013-T016 after implementation

## Parallel Opportunities

- T002 and T003 can be written in parallel.
- Pure model/service work can be reviewed separately from panel integration.

## Implementation Strategy

Implement foundational pure functions first, then wire transport UI behavior, then validate export contract and full project checks.
