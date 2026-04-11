# Implementation Plan: Portable Static Build

**Branch**: `002-portable-static-build` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-portable-static-build/spec.md`

## Summary

Adapt the static build pipeline so the generated app can be opened directly from
the local filesystem while preserving normal static hosting. The implementation
should emit a portable `dist/` whose entry HTML references scripts and styles by
relative paths, provide explicit npm commands for development, packaging, and
preview, and keep the shell loading without an engine connection.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vite, dockview-core  
**Storage**: N/A  
**Testing**: Typecheck, lint, unit tests, production build, manual visual validation from `file://` and HTTP-served output  
**Target Platform**: Modern desktop browsers  
**Project Type**: Static web application  
**Performance Goals**: No meaningful regression in initial shell load or panel responsiveness  
**Constraints**: Browser-only runtime, static deployment, portable built assets, open source dependencies only, no backend  
**Scale/Scope**: Build configuration, generated asset paths, package scripts,
packaging docs, and small runtime notices needed for local opening

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Static runtime preserved: the change affects packaging only and does not add a backend or server dependency.
- Real-time behavior protected: local-open packaging must not introduce blocking runtime behavior.
- Modern browser compatibility addressed: the packaged output must still target supported modern browsers.
- Local engine contract defined: local opening cannot assume the engine is immediately available and must keep connection status visible.
- Maintainability preserved: packaging behavior and runtime limitations are documented explicitly.

Post-design re-check: PASS. The planned change strengthens static portability
without violating browser-only execution or the open source policy.

## Project Structure

### Documentation (this feature)

```text
specs/002-portable-static-build/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- portable-build-contract.md
`-- checklists/
    `-- requirements.md
```

### Source Code (repository root)

```text
index.html
vite.config.ts
package.json
src/
|-- app/
|-- styles/
`-- ws/
```

**Structure Decision**: Keep implementation focused on build configuration,
package scripts, packaging assumptions, and minimal runtime notice logic. Avoid
introducing a separate packaging subsystem.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
