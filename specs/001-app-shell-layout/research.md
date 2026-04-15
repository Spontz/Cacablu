# Research: Application Shell Layout

## Decision: Use a static web app bootstrap with Vite for development and build

**Rationale**: The runtime remains pure browser code, while Vite provides a
simple development and build workflow for TypeScript modules and CSS without
introducing a backend runtime requirement.

**Alternatives considered**:
- Plain handwritten TypeScript compilation without a bundler: simpler in theory
  but slower to evolve once CSS imports and third-party packages are added.
- A framework-heavy SPA stack: unnecessary complexity for the first shell.

## Decision: Use `dockview-core` for the workspace layout engine

**Rationale**: `dockview-core` is framework-agnostic, open source, TypeScript
friendly, and directly matches the requirement for docked panels, tabs, and a
future expandable workspace.

**Alternatives considered**:
- A fully custom layout manager: too expensive for a non-differentiating problem.
- A React-based docking library: rejected because the current decision is to
  keep the shell in TypeScript without adding React as the app foundation.

## Decision: Keep the menubar custom and lightweight

**Rationale**: The first shell only needs a predictable top-level interaction
surface. A custom DOM-based menubar keeps the dependency surface small and
avoids coupling basic commands to a larger UI framework.

**Alternatives considered**:
- Using a larger menu framework: more capability than needed for the first shell.
- Deferring menus entirely: rejected because menus are part of the required base layout.

## Decision: Separate shell state from engine communication

**Rationale**: A minimal app state module and a separate WebSocket module keep
the layout scaffold independent from transport details, making it easier to test
and extend later.

**Alternatives considered**:
- Combining UI state and socket state in panel components: faster initially, but
  it would make future expansion and testing harder.

## Decision: Validate with manual visual testing plus lightweight code checks

**Rationale**: The shell is primarily a UI foundation, so manual validation is
required. Typecheck, lint, and focused unit tests are enough to protect the
foundational logic without overbuilding the test suite.

**Alternatives considered**:
- Only manual validation: insufficient protection for message and state logic.
- Heavy end-to-end automation up front: too much cost for the first skeleton.
