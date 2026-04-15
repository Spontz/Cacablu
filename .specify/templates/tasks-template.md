---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Validation**: Every story MUST include manual visual validation. Unit tests and
compile/lint checks MUST be added when they protect logic or browser code
changed by the feature. If the feature is meant to work without a server, tasks
MUST include explicit validation of the local/static execution path. If the
feature depends on File System Access API support, tasks MUST validate that
assumption explicitly.

**Organization**: Tasks are grouped by user story to enable independent
implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project. Adjust based on `plan.md`.

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Validated independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting, typechecking, and formatting tools
- [ ] T004 Define browser/runtime validation approach and required manual visual checks

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T005 Setup shared state, timing, or messaging foundations required by all stories
- [ ] T006 [P] Define or update shared WebSocket protocol types/contracts
- [ ] T007 [P] Setup browser compatibility or worker strategy for performance-sensitive work
- [ ] T008 Create base models/entities that all stories depend on
- [ ] T009 Configure error handling and logging infrastructure
- [ ] T010 Setup configuration handling that still preserves static deployment

**Checkpoint**: Foundation ready. User story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) MVP

**Goal**: [Brief description of what this story delivers]

**Independent Validation**: [How to verify this story works on its own]

### Validation for User Story 1 (required)

> **NOTE**: Write automated validation first when behavior is deterministic.
> Manual visual validation is still required before completion.

- [ ] T011 [P] [US1] Add or update unit/contract test for [behavior] in tests/[path]/test_[name].py
- [ ] T012 [US1] Run manual visual validation for [interaction/output] and record the result
- [ ] T013 [US1] Run compile/lint checks for changed browser code

### Implementation for User Story 1

- [ ] T014 [P] [US1] Create [Entity1] model in src/models/[entity1].py
- [ ] T015 [P] [US1] Create [Entity2] model in src/models/[entity2].py
- [ ] T016 [US1] Implement [Service] in src/services/[service].py (depends on T014, T015)
- [ ] T017 [US1] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T018 [US1] Add validation and error handling
- [ ] T019 [US1] Document or update WebSocket contract and degraded behavior if engine-dependent

**Checkpoint**: At this point, User Story 1 should be fully functional and independently validated

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Validation**: [How to verify this story works on its own]

### Validation for User Story 2 (required)

- [ ] T020 [P] [US2] Add or update unit/contract test for [behavior] in tests/[path]/test_[name].py
- [ ] T021 [US2] Run manual visual validation for [interaction/output] and record the result
- [ ] T022 [US2] Run compile/lint checks for changed browser code

### Implementation for User Story 2

- [ ] T023 [P] [US2] Create [Entity] model in src/models/[entity].py
- [ ] T024 [US2] Implement [Service] in src/services/[service].py
- [ ] T025 [US2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T026 [US2] Integrate with User Story 1 components (if needed)

**Checkpoint**: At this point, User Stories 1 and 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Validation**: [How to verify this story works on its own]

### Validation for User Story 3 (required)

- [ ] T027 [P] [US3] Add or update unit/contract test for [behavior] in tests/[path]/test_[name].py
- [ ] T028 [US3] Run manual visual validation for [interaction/output] and record the result
- [ ] T029 [US3] Run compile/lint checks for changed browser code

### Implementation for User Story 3

- [ ] T030 [P] [US3] Create [Entity] model in src/models/[entity].py
- [ ] T031 [US3] Implement [Service] in src/services/[service].py
- [ ] T032 [US3] Implement [endpoint/feature] in src/[location]/[file].py

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional unit tests for shared browser logic in tests/unit/
- [ ] TXXX Validate browser compatibility assumptions
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel if staffed
  - Or sequentially in priority order (P1 -> P2 -> P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2). May integrate with US1 but should be independently validatable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2). May integrate with US1/US2 but should be independently validatable

### Within Each User Story

- Automated validation MUST be written first when practical
- Models before services
- Services before endpoints
- Core implementation before integration
- Manual visual validation and compile/lint checks before closing the story
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel within Phase 2
- Once Foundational phase completes, all user stories can start in parallel if team capacity allows
- Validation tasks for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```text
Task: "Add or update unit/contract test for [behavior] in tests/[path]/test_[name].py"
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run manual visual validation and compile/lint checks
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Validate independently -> Deploy/Demo (MVP)
3. Add User Story 2 -> Validate independently -> Deploy/Demo
4. Add User Story 3 -> Validate independently -> Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and independently validatable
- Verify automated checks fail first when applicable
- Always complete manual visual validation
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid vague tasks, same-file conflicts, and cross-story dependencies that break independence
