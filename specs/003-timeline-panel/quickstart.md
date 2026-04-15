# Quickstart: Timeline Panel

## Purpose

Validate the timeline panel in the shell and the reusable timeline package in a
focused demo-like workflow.

## Prerequisites

- Node.js installed
- `npm install` completed
- A browser that supports the File System Access API baseline used by the
  project

## Commands

1. Start the shell in development mode:

```bash
npm run dev
```

2. Open the timeline panel inside the shell and confirm:

- the ruler is visible
- the playhead is visible
- the transport bar is below the timeline
- click-scrub works on the ruler
- `Shift + wheel` zooms
- the plain wheel scrolls

3. Build a portable static output:

```bash
npm run build
```

4. Open the generated `dist/index.html` directly from the filesystem in a
supported browser and confirm the app still loads.

## Validation Checklist

- Timeline panel opens without helper copy above the ruler
- Transport buttons move the current time correctly
- Selection and editing interactions remain available in the panel model
- Static build remains openable from the filesystem
- Lint, typecheck, and build all succeed
