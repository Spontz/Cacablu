<!--
Sync Impact Report
- Version change: 1.1.1 -> 1.2.0
- Modified principles:
  - Template Principle 1 -> I. Browser-Only Static Runtime
  - Template Principle 2 -> II. Real-Time Interaction First
  - Template Principle 3 -> III. File System Access Browser Compatibility
  - Template Principle 4 -> IV. Understandable Code as a Product Requirement
  - Template Principle 5 -> V. Explicit Local Engine Contract
- Added sections:
  - Technical Constraints
  - Validation and Delivery Workflow
- Removed sections:
  - None
- Templates requiring updates:
  - .specify/templates/plan-template.md: updated
  - .specify/templates/spec-template.md: updated
  - .specify/templates/tasks-template.md: updated
  - .specify/templates/commands/*.md: pending (directory not present in this repository)
- Follow-up TODOs:
  - None
-->

# Cacablu Constitution

## Core Principles

### I. Browser-Only Static Runtime
Cacablu MUST run entirely inside a web browser as a static application. The app
MUST NOT require a backend, server-side rendering, or a long-running companion
process to deliver its own interface logic. Deployment MUST be possible from a
plain HTML server or by opening the main page locally in a browser. JavaScript
and TypeScript compiled for the browser are the runtime.

Rationale: The product is intended to be portable, easy to host, and free from
infrastructure dependencies outside the user's machine and browser.

### II. Real-Time Interaction First
Real-time response to user interaction is the highest engineering priority.
Design and implementation choices MUST favor low-latency interaction, timeline
accuracy, and smooth message exchange with the local visuals engine. Work MAY
use browser capabilities such as Workers when they materially protect UI
responsiveness, isolate heavy work, or improve scheduling predictability.

Rationale: If the interface does not remain responsive in real conditions, the
tool fails at its primary purpose.

### III. File System Access Browser Compatibility
The application MUST target browsers that support the File System Access API.
Features that rely on unsupported browser environments MUST be rejected unless
they include a concrete fallback that preserves the core user workflow without
server dependency. If a browser lacks the File System Access API, it is out of
scope unless the feature is explicitly designed to degrade gracefully without
losing primary functionality.

Rationale: The product relies on direct local file interactions, so the browser
baseline must support that capability rather than the broadest possible market.

### IV. Understandable Code as a Product Requirement
Code MUST be clean, navigable, and understandable by another developer without
oral context. Complex logic, protocol handling, state transitions, and timing
assumptions MUST be commented where intent is not self-evident. Naming MUST be
clear, module responsibilities MUST be narrow, and avoidable cleverness is
prohibited.

Rationale: The project is maintained by a small team, so readability directly
affects delivery speed and long-term reliability.

### V. Explicit Local Engine Contract
Communication with the user's local visuals engine MUST be defined through
explicit WebSocket contracts, message formats, and failure handling behavior.
Features that depend on engine messages, resource metadata, timeline events, or
timing synchronization MUST document expected inputs, outputs, and degraded
behavior when the engine is unavailable or slow.

Rationale: Without a documented contract, browser code and local engine logic
will drift and become fragile.

## Technical Constraints

- The product operates in a single browser window.
- TypeScript is the required implementation language for browser code.
- `dockview-core` is the standard foundation for docked panels, tabs, and window
  layout behavior unless a documented exception is approved.
- The repository MUST prefer browser-native architecture over backend-style
  abstractions.
- Static hosting is mandatory; normal operation MUST NOT depend on a server
  process, cloud service, or database.
- The application SHOULD be able to run from local files or static hosting
  without requiring a custom server whenever browser security constraints allow
  it. If a server is unavoidable for a specific capability, that dependency MUST
  be justified explicitly and kept outside the normal user workflow.
- Browser compatibility is intentionally constrained to environments supporting
  the File System Access API.
- Performance-sensitive work MUST avoid blocking the main thread when a browser
  concurrency primitive can reasonably isolate it.
- Dependencies introduced into the product toolchain or runtime MUST be open
  source software with licensing compatible with project use.
- All user-visible protocol assumptions with the local engine MUST be traceable
  in specs, plans, or implementation comments.

## Validation and Delivery Workflow

- Every feature spec MUST describe the user interaction being protected and any
  browser compatibility or latency assumptions, including File System Access
  API requirements when relevant.
- Every plan MUST pass a constitution check covering static deployability,
  real-time impact, browser compatibility, protocol clarity, and code
  maintainability.
- Changes MUST be validated with a manual visual test before completion.
- Unit tests SHOULD be added for logic that can regress independently of the
  visuals engine, especially protocol parsing, state handling, timing logic, and
  utility behavior.
- JavaScript and TypeScript changes MUST pass the project's compile or lint
  checks before completion.
- Build outputs and packaging SHOULD preserve a no-server execution path for the
  delivered artifact whenever the browser platform permits it.

## Governance

This constitution overrides informal implementation habits for the repository.
Specification, planning, task generation, review, and implementation MUST be
evaluated against it.

The team may amend the constitution whenever needed, but every amendment MUST
include written justification, explicit owner approval, and semantic versioning
of the document itself. For this repository, owner approval means approval by
the user maintaining the project direction.

Versioning policy:
- MAJOR: Removes or materially redefines a core principle or governance rule.
- MINOR: Adds a new principle, section, or materially stronger requirement.
- PATCH: Clarifies wording, intent, or enforcement without changing substance.

Compliance review expectations:
- Plans MUST record how they preserve static deployment and browser-only
  execution.
- Plans MUST state whether the feature depends on the File System Access API and
  how unsupported browsers are handled.
- Plans MUST explain any case where a server is needed and describe the minimal
  scope of that dependency.
- Task lists MUST include validation work, including manual visual verification.
- Reviews MUST reject changes that undermine browser compatibility, real-time
  responsiveness, protocol clarity, maintainability, or the open source
  dependency policy without explicit justification.

**Version**: 1.2.0 | **Ratified**: 2026-04-11 | **Last Amended**: 2026-04-14
