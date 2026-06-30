# Quickstart: Phoenix Time Sync

## Prerequisites

- Phoenix is built with the native editor API change.
- Phoenix is launched in slave mode so the editor WebSocket API is listening.
- Cacablu dependencies are installed with `npm install`.

## Run Cacablu

```powershell
cd C:\Users\ifernandez\Documents\GitHub\spontz-cacablu
npm run dev
```

Open the Vite URL shown in the terminal.

## Manual Validation

1. Start Phoenix in slave mode.
2. Open Cacablu.
3. Open the timeline panel.
4. Confirm the connection state becomes connected.
5. Confirm the playhead time matches Phoenix runtime time.
6. Press Play/Pause and confirm Phoenix starts or pauses.
7. Press Go to Beginning and confirm Phoenix seeks to `0`.
8. Press Rewind and confirm Phoenix seeks backward by the configured delta.
9. Press Forward and confirm Phoenix seeks forward by the configured delta.
10. Press Go to End and confirm Phoenix seeks to the known end time.
11. Stop Phoenix and confirm Cacablu does not crash.
12. Confirm all five transport buttons are disabled while Phoenix is disconnected.

## Project Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

## Notes

- Section editing and asset synchronization are outside this feature.
- The existing engine data export flow remains separate from live Phoenix transport control.
