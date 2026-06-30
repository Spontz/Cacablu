# Tasks: Phoenix Time Sync

**Input**: Design documents from `/specs/010-phoenix-time-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Validation**: Manual validation requires a Phoenix build with the native editor WebSocket API running in slave mode. Project checks are `npm run typecheck`, `npm run lint`, and `npm run build`.

## Phase 1: Setup

- [x] T001 Confirm the timeline panel remains the target browser surface in `src/panels/timeline-panel.ts`
- [x] T002 Confirm the existing `src/ws` module is the place for Phoenix WebSocket connection and message normalization

---

## Phase 2: Foundational

- [x] T003 [P] Define Phoenix runtime WebSocket message types and validators in `src/ws/messages.ts`
- [x] T004 [P] Create or extend a Phoenix WebSocket connection controller in `src/ws/connection.ts`
- [ ] T005 [P] Add unit tests for runtime message normalization and transport command formatting

---

## Phase 3: User Story 1 - Connect Timeline to Phoenix Time (Priority: P1)

**Goal**: Show Phoenix runtime time in the Cacablu timeline.

**Independent Validation**: Connect to Phoenix and confirm the timeline playhead follows `runtime.state.time`.

- [x] T006 [US1] Connect the timeline panel to the Phoenix WebSocket controller in `src/panels/timeline-panel.ts`
- [x] T007 [US1] Apply `runtime.state.time` to timeline current time and playhead rendering
- [x] T008 [US1] Apply Phoenix `playing` and valid `endTime` values to local timeline transport state
- [x] T009 [US1] Keep Phoenix connection status visible through the existing toolbar indicator without duplicating it in the timeline

---

## Phase 4: User Story 2 - Control Phoenix from Five Transport Buttons (Priority: P1)

**Goal**: Map the five transport buttons to Phoenix runtime commands.

**Independent Validation**: Press each button while connected and confirm Phoenix responds.

- [x] T010 [US2] Enable Go to Beginning, Rewind, Play/Pause, Forward, and Go to End only when Phoenix is connected
- [x] T011 [US2] Send `runtime.seek` time `0` from Go to Beginning
- [x] T012 [US2] Send clamped backward `runtime.seek` from Rewind
- [x] T013 [US2] Send `runtime.toggle` from Play/Pause so Phoenix toggles from its authoritative playback state
- [x] T014 [US2] Send clamped forward `runtime.seek` from Forward
- [x] T015 [US2] Send end-time `runtime.seek` from Go to End
- [x] T016 [US2] Disable all five transport buttons and prevent command sends while Phoenix is disconnected, connecting, or in an error state

---

## Phase 5: User Story 3 - Handle Connection States Clearly (Priority: P2)

**Goal**: Keep the timeline stable and understandable across connection changes.

**Independent Validation**: Open Cacablu before Phoenix, start Phoenix, then stop Phoenix.

- [x] T017 [US3] Handle WebSocket open, close, error, and malformed message paths without throwing
- [x] T018 [US3] Keep the last known timeline time visible after Phoenix disconnects
- [x] T019 [US3] Ensure reconnect/refresh behavior is documented in `quickstart.md`

---

## Phase 6: Polish & Validation

- [x] T020 Run `npm test`
- [x] T021 Run `npm run typecheck`
- [x] T022 Run `npm run lint`
- [x] T023 Run `npm run build`
- [ ] T024 Manually validate the five transport buttons against Phoenix in slave mode

---

## Dependencies & Execution Order

- Setup before Foundational
- Foundational before timeline integration
- US1 and US2 can be implemented together after the WebSocket controller exists
- US3 follows once connected behavior is visible
- Polish depends on implemented stories

## Parallel Opportunities

- T003, T004, and T005 can proceed in parallel.
- T011-T015 are small independent command mappings once T010 is done.
- Project checks can run after the implementation tasks are complete.

## Implementation Strategy

1. Add message and command helpers first.
2. Add the WebSocket controller.
3. Wire runtime state into the timeline playhead.
4. Wire the five buttons to commands.
5. Validate disconnected and malformed-message paths.
