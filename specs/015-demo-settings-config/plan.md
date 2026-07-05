# Implementation Plan: Demo Settings Config

## Summary

Add a floating Demo Settings panel to Cacablu and connect it to Phoenix's new demo settings API. Cacablu edits user-facing controls, calculates `demoEnd` from the current timeline bars, and sends the payload to Phoenix. Phoenix applies the settings in memory and writes `data/config/control.spo`.

## Technical Context

- **Language/Version**: TypeScript, browser runtime.
- **Primary Dependencies**: Mantine UI, existing floating panel system, existing menu model, existing Phoenix client utilities, existing project DB and timeline selectors.
- **Storage**: Project DB for bar data and optional Cacablu defaults; Phoenix disk persistence through the API.
- **Testing**: Unit tests for payload construction and log detail mapping where practical; Playwright/manual verification for menu and panel behavior.

## Constraints

- Cacablu must not write Phoenix `data/config/control.spo` directly.
- Applying settings must not trigger a full Phoenix project sync.
- `demoEnd` must be calculated at apply time from current bars.
- `log_detail 4` is a legacy value and must not be exposed by the UI.
- Errors must go to Events, not alerts.

## Project Structure

- `src/menus`: Edit menu item and separator.
- `src/panels`: Demo Settings floating panel.
- `src/phoenix`: demo settings client calls and response validation.
- `src/timeline`: helper/selectors for maximum bar end time.
- `src/events`: Events entries for validation and Phoenix failures.
