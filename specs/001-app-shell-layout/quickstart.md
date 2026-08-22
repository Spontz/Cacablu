# Quickstart: Application Shell Layout

## Goal

Run the first browser-only shell for Cacablu and verify that the workspace
layout, menu bar, and shell state behave correctly before real engine features
are added.

## Expected Setup

- Node.js installed locally
- Project dependencies installed from the repository root

## Run

```bash
npm install
npm run dev
```

Open the local development URL in a modern desktop browser.

## Manual Validation Checklist

1. Confirm the app loads into a single-window shell.
2. Confirm the top menu bar is visible.
3. Confirm the default panels render: Resources, Timeline, Preview, Inspector,
   and Events.
4. Drag and resize panels to verify the layout engine is active.
5. Float a panel and drag it upward; confirm it stops below the menu bar and
   its title bar and close control remain fully reachable.
6. With a floating panel open, resize the browser viewport and reset or restore
   the layout; confirm the panel is repositioned below the menu bar if needed.
7. Use the menu bar to reset the layout.
8. Confirm the connection state is visible even without a running local engine.
9. Open Events and confirm Copy is disabled before selecting an event.
10. Select an event, confirm its row is visibly selected, invoke `Edit > Copy`,
    and paste into a plain-text field; verify the exact description is pasted.
11. With the same event selected and no highlighted text, verify the platform
    copy shortcut produces the same plain-text value.
12. Highlight only part of an event description and verify the copy shortcut
    preserves the browser's partial-text copy behavior.
13. Clear the event list and confirm the selection disappears and Copy becomes
    disabled.

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Notes

- The shell must still work when served as static files after build output is produced.
- Real engine communication can remain mocked or disconnected during this phase.
