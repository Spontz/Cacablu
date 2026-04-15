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
5. Use the menu bar to reset the layout.
6. Confirm the connection state is visible even without a running local engine.

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Notes

- The shell must still work when served as static files after build output is produced.
- Real engine communication can remain mocked or disconnected during this phase.
