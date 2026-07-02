# Quickstart: Phoenix Data Asset Sync

## Prerequisites

1. Build Phoenix with the native editor API enabled.
2. Launch Phoenix in slave mode so the editor API is available on `127.0.0.1:29100`.
3. Open Cacablu in a browser that supports the File System Access API.
4. Load a Cacablu project before attempting asset sync.

## Manual Validation Flow

1. Open Cacablu without loading a project.
2. Attempt to trigger asset sync.
3. Confirm Cacablu blocks transfer because no project is loaded.
4. Load a valid project.
5. Start or connect to Phoenix.
6. Confirm the initial sync modal appears and blocks interaction until complete.
7. Confirm Cacablu requests Phoenix's asset manifest.
8. If Phoenix pool already matches the enabled project pool file set, confirm Cacablu skips copying.
9. If Phoenix pool differs, confirm Cacablu clears Phoenix `pool`, recreates it, and uploads every enabled project pool file.
10. Confirm Cacablu requests Phoenix's section manifest after the pool sync completes or is skipped.
11. If Phoenix sections already match the serialized project bars, confirm Cacablu skips section replacement.
12. If Phoenix sections differ, confirm Cacablu sends one full replace-all request and Phoenix ends with one runtime section per project bar.
13. Confirm Phoenix's active `data` folder contains one root `.spo` file per received section, named `<id>.spo` such as `17.spo`.
14. Confirm `.spo` files for sections removed by the replacement are deleted from Phoenix's active `data` folder.
15. Cancel the initial sync during section synchronization in a separate run and confirm the opened project is not loaded into the workspace.
16. Toggle a pool file checkbox and confirm Cacablu writes or deletes that file in Phoenix.
17. Drag a file into an Assets folder and confirm the database and Phoenix receive the new file.
18. Move a file between Assets folders and confirm Phoenix reflects the new path.
19. Delete a file or folder under `pool` or `resources`.
20. Confirm Phoenix receives and applies the matching delete operation.
21. Try to sync a path under `config`.
22. Confirm Cacablu blocks or warns and no Phoenix mutation is sent.

## Expected User-Visible States

- `Blocked`: no project loaded or initial project sync was cancelled.
- `Disconnected`: Phoenix is not available.
- `Scanning`: expected published pool manifest is being built.
- `Cleaning`: Phoenix pool is being deleted/recreated before a full copy.
- `Copying`: enabled pool files are being written to Phoenix.
- `Syncing sections`: project bars are being compared or sent to Phoenix as runtime sections.
- `Synchronized`: expected published pool and Phoenix pool match.
- `Applying`: one or more asset operations are in flight.
- `Error`: last sync or operation failed but the app remains usable.

## Project Checks

Run after implementation:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

## Notes

- This feature does not require Phoenix to hot-reload already loaded shaders, textures, models, sounds, or other resources.
- Section replacement is runtime state sync and should update Phoenix's section timeline; Phoenix is responsible for writing root `<id>.spo` files in its active `data` folder.
- This feature does not sync `config`.
- If Phoenix is disconnected, Cacablu may still show local project folder state but must not report engine synchronization.
