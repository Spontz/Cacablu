# Quickstart: Playback Engine Data Export

## Prerequisites

- Use a desktop browser that supports local folder selection and writing.
- Have a SQLite project file with resources available.
- Have a writable local folder to act as the visualization engine folder.

## Manual Validation Flow

1. Build or open the app in a supported browser.
2. Confirm the app starts with all timeline transport buttons disabled.
3. Open a valid SQLite project.
4. Confirm only the Play button becomes enabled.
5. Press Play.
6. Confirm the browser asks for a folder location.
7. Cancel the picker and confirm no `data` folder is created.
8. Press Play again.
9. Choose a writable engine folder.
10. Confirm a folder named `data` appears in that folder.
11. Open `data/pool` and confirm it contains the project files from the SQLite file.
12. Open `data` and confirm it contains one `.spo` file per bar, named `<id>-<type>.spo`.
13. Open `data/config/graphics.spo` and confirm it contains `gl_` lines followed by FBO blocks.
14. Open `data/config/loader.spo` and confirm it starts with `:::loading` followed by the SQLite `loaderCode` text.
15. Open `data/config/control.spo` and confirm it contains demo control values plus fixed `debug`, `sound`, `slave`, `debugEnableAxis`, and `debugEnableFloor` values set to `1`.
16. Open `data/resources` and confirm it contains the copied contents of the selected engine folder's `resources` folder.
17. Compare the exported folder/file hierarchy and names with the Pool panel tree.
18. Repeat with an existing `data` folder and confirm the old folder is deleted before the new export appears.

## Expected Results

- Before project load: all transport buttons are disabled.
- After project load: only Play is enabled.
- On Play: folder selection happens before any file write.
- On cancel: no file changes occur.
- On success: `data/pool` contains the SQLite resource files, `data` contains the section `.spo` files, `data/config` contains `graphics.spo`, `loader.spo`, and `control.spo`, `data/resources` contains the copied engine resources, and the UI reports preparation success.
- On write failure: the UI reports an error and remains usable.

## Automated Checks

Run these before completing implementation:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```
