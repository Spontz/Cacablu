# Implementation Plan: Reliable Timeline Keyboard Clipboard In Edge

## Technical Approach

Use one bar-envelope capture and system-clipboard publication boundary for both the Edit menu and Timeline `Ctrl+C`. Keep Paste on the trusted native `paste` event so Edge supplies `DataTransfer` without requiring asynchronous clipboard permission. Preserve the local snapshot only as a format-loss fallback and never consume it after Paste.

## Phases

1. Add a focused Edge regression test with no granted clipboard permissions.
2. Route non-editable Timeline `Ctrl+C` through the existing system clipboard writer during the keyboard gesture.
3. Preserve native editable-control behavior and native cross-tab Paste routing.
4. Validate repeated same-project Paste, cross-tab Paste, menu parity, Undo, and quality gates.

## Files

- `src/app/shell.ts`: keyboard routing and shared Copy publication.
- `src/resources/system-clipboard.ts`: existing trusted Copy/system API adapter; change only if Edge evidence requires it.
- `scripts/playwright-edge-timeline-keyboard-clipboard-check.mjs`: literal no-permission Edge regression.
- `tests/unit/`: focused helper coverage if routing logic is extracted.

