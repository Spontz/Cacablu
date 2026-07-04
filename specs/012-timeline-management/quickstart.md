# Quickstart: Timeline Management

## Prerequisites

- A Chromium-based browser with File System Access API support.
- A copy of a Cacablu SQLite project.
- Optional: Phoenix running in slave mode for sync validation.

## Manual Validation

1. Start Cacablu.
2. Open Window > Timeline without loading a project.
3. Confirm the timeline opens with no default bars and no default layers.
4. Open a known SQLite project.
5. Confirm the timeline shows bars from the project database.
6. Single-click a bar and confirm Bar Editor opens on the right.
7. Close Bar Editor, single-click the same bar again, and confirm it reopens.
8. Confirm Bar Editor shows Bar Type, Script Template, Save Template, code editor, Blend Source, Blend Destination, Blend Equation, and Apply.
9. Confirm Blend Equation offers Add, Subtract, and Reverse subtract.
10. Choose Bars > Display IDs and confirm timeline labels show `<id> <name>`.
11. Confirm the menu item becomes Ocultar IDs and toggles labels back to names only.
12. Change script or blend values, click Apply, save the project, reopen it, and confirm edits persist.
13. Move a bar in time and confirm its displayed start/end update.
14. Move a bar to another layer and confirm the layer changes.
15. Resize a bar and confirm duration remains positive.
16. Create a new bar and confirm it appears in the timeline.
17. Delete a selected bar and confirm it disappears and Bar Editor clears.

## Phoenix Sync Validation

1. Start Phoenix in slave mode.
2. Open Cacablu and connect to Phoenix.
3. Load a project.
4. Edit a timeline bar.
5. Confirm Cacablu performs a debounced section sync.
6. Confirm the sync modal progress counter advances only while Cacablu processes counted local work.
7. Confirm Phoenix receives updated sections.
8. Trigger or load a project with a known section sync error.
9. Confirm Events lists the error and the matching timeline bar is red.
10. Clear Events and confirm the red bar marking clears.
11. Stop Phoenix or disconnect it.
12. Edit another timeline bar.
13. Confirm the local edit remains and an Event records the missing sync.

## Transport Visual Validation

1. Start playback from Timeline or Phoenix.
2. Confirm the current-time line shows a glow trail while moving.
3. Pause playback.
4. Confirm the trail fades away and only a subtle glow remains on the vertical line.

## Quality Gates

Run:

```bash
npm test
npm run typecheck
npm run build
```
