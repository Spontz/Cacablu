# Tasks: Reliable Timeline Keyboard Clipboard In Edge

- [x] T001 Document the Edge keyboard clipboard defect and acceptance scenarios in Spec Kit.
- [x] T002 Add an Edge Playwright regression with no pre-granted clipboard permissions.
- [x] T003 Make Timeline `Ctrl+C` explicitly publish through the shared system clipboard writer.
- [x] T004 Verify repeated same-project keyboard Paste and Undo.
- [x] T005 Verify cross-tab keyboard Paste between independent loaded tabs.
- [x] T006 Verify editable text targets retain native clipboard behavior.
- [x] T007 Run typecheck, focused lint, full unit tests, production build, and Edge validation.
- [x] T008 Record validation results and close the spec only after the literal user sequence passes with Windows-level keyboard input and manual confirmation.
- [x] T009 Compare the keyboard flow with Selenium WebDriver and record whether it differs from Playwright, Windows SendKeys, or the user's physical keyboard.

## Root Cause Found With Selenium

- Clicking a Timeline bar or empty lane focused the Timeline DOM, selected the layer, and delivered valid `copy`/`paste` events, but did not update `AppState.activePanelId` from the Resources panel opened last.
- The shell routed the rich payload to Timeline from the event target, but `handleTimelineClipboardPaste` then discarded it because of the stale active-panel guard.
- Timeline pointer interaction now sets `activePanelId` to `timeline`, and the redundant guard was removed from the already-routed Timeline paste handler.
- Selenium now passes system clipboard Copy, repeated same-project Paste, and cross-tab Paste with the 371-bar desktop project.
- Windows-level SendKeys, the full Playwright Timeline/Pool regression, 183 unit tests, scoped lint, typecheck, and production build pass.
- Manual physical-keyboard confirmation passed in the user's normal Microsoft Edge session.

## Closure

- **Status**: Closed
- **Closed**: 2026-07-21
- **Result**: Timeline pointer interaction now establishes Timeline as the active clipboard context, and keyboard Copy/Paste works manually, through Selenium, through Windows-level input, and through the full Playwright regression.

## Validation Results

- Microsoft Edge loaded `C:\Users\merlu\Desktop\20251011 Evoke updated to new engine.sqlite` without pre-granted clipboard permissions.
- The literal bar click → `Ctrl+C` → empty lane click → `Ctrl+V` sequence passed.
- Repeated keyboard Paste, cross-tab Paste, two Undo operations, and native editable-text Copy/Paste passed.
- The full two-tab Timeline and Pool Playwright regression passed in Microsoft Edge.
- `npm run typecheck`: passed.
- Scoped ESLint: passed.
- `npm test`: 28 files and 183 tests passed.
- `npm run build`: passed with only the existing Mantine directive and bundle-size warnings.

## Reopened Defect

- **Reopened**: 2026-07-21
- **Reason**: Playwright CDP keyboard input passed, but a physical keyboard in the user's normal Edge session still failed. Closure now requires Windows-level shortcut injection plus manual confirmation.
