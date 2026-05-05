# Cacablu Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-05

## Active Technologies
- TypeScript (browser, targeting ES2020+) + `dockview-core` ^5.2.0 (panel layout), `sql.js` ^1.14.1 (already loaded by shell; not touched by this feature) (main)
- In-memory `ProjectDatabase` provided via `DbSessionRef`; no direct SQLite access (main)
- TypeScript 5.x, browser target ES2020+ + `dockview-core` ^5.2.0 for panels/layout, `sql.js` ^1.14.1 for already-loaded project database sessions (007-image-preview-inspector)
- In-memory `ProjectDatabase` exposed through `DbSessionRef`; no direct SQLite queries in panel code (007-image-preview-inspector)
- TypeScript 5.x, browser target ES2020+ + `dockview-core` ^5.2.0, `sql.js` ^1.14.1, new `three` runtime dependency for WebGL preview and loaders (008-3d-preview-inspector)
- In-memory `ProjectDatabase` exposed through `DbSessionRef`; no direct SQLite queries in preview code (008-3d-preview-inspector)

- TypeScript 5.x + Vite, dockview-core, existing browser DOM/CSS runtime (main)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x: Follow standard conventions

## Recent Changes
- 008-3d-preview-inspector: Added TypeScript 5.x, browser target ES2020+ + `dockview-core` ^5.2.0, `sql.js` ^1.14.1, new `three` runtime dependency for WebGL preview and loaders
- 007-image-preview-inspector: Added TypeScript 5.x, browser target ES2020+ + `dockview-core` ^5.2.0 for panels/layout, `sql.js` ^1.14.1 for already-loaded project database sessions
- main: Added TypeScript (browser, targeting ES2020+) + `dockview-core` ^5.2.0 (panel layout), `sql.js` ^1.14.1 (already loaded by shell; not touched by this feature)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
