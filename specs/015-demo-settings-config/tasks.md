# Tasks: Demo Settings Config

## Phase 1: State And Types

- [x] T001 Add `DemoSettingsDraft`, `DemoSettingsPayload`, and `LogDetailOption` types.
- [x] T002 Add a timeline helper that calculates maximum bar end time from the loaded project.
- [x] T003 Add log detail option constants for `0 None`, `1 Essential`, `2 Normal`, and `3 Verbose`.

## Phase 2: Phoenix Client

- [x] T004 Add `GET /api/demo-settings` client support.
- [x] T005 Add `PUT /api/demo-settings` client support.
- [x] T006 Validate Phoenix demo settings responses before applying UI success state.
- [x] T007 Route connection and validation failures to Events.

## Phase 3: UI

- [x] T008 Add `Edit > Demo Settings` after a separator from edit commands.
- [x] T009 Create the centered floating Demo Settings panel.
- [x] T010 Add title, Loop demo, Sound, Debug grid, and Log detail controls with Mantine components.
- [x] T011 Initialize controls from Phoenix settings when connected and from defaults otherwise.
- [x] T012 Disable or safely reject apply when no project is loaded.

## Phase 4: Apply Flow

- [x] T013 Build the payload using the current draft and current maximum bar end time.
- [x] T014 Send the payload to Phoenix without triggering full project sync.
- [x] T015 Keep the panel open and write Events when Phoenix rejects the request.
- [x] T016 Confirm successful writes without using blocking alerts.

## Phase 5: Verification

- [x] T017 Test that `demoEnd` equals the latest timeline bar end.
- [x] T018 Test that empty demo names cannot be sent.
- [x] T019 Test that `logDetail` cannot be `4`.
- [x] T020 Manually verify Phoenix writes `data/config/control.spo` with the expected content.
