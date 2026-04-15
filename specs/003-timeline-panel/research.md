# Research: Timeline Panel

## Decision 1: Keep the timeline as a reusable internal package

- Decision: Use `packages/timeline` as the source of truth for timeline state,
  track/clip models, and helper utilities.
- Rationale: The current shell already embeds timeline behavior, and a package
  keeps the model reusable without introducing a second app or backend.
- Alternatives considered:
  - Build timeline logic only inside `src/panels/timeline-panel.ts`
  - Extract the timeline into a separate repository

## Decision 2: Render the timeline with the existing browser DOM/CSS stack

- Decision: Keep the first implementation DOM/CSS-driven inside the docked
  panel, with no new rendering library introduced.
- Rationale: The app already runs in the browser, and the current panel needs
  dense layout, ruler rendering, transport controls, and scroll/zoom behavior
  without extra runtime complexity.
- Alternatives considered:
  - Canvas-based rendering
  - SVG-only rendering
  - A third-party timeline library

## Decision 3: Use a stateless helper model plus stateful timeline instances

- Decision: Keep reusable helpers such as `createTimelineState`,
  `createTrack`, and `createClip`, while allowing each panel instance to own its
  own timeline state.
- Rationale: This supports the shell panel and any demo surface without shared
  mutable global state.
- Alternatives considered:
  - Global singleton timeline store
  - Fully immutable event-sourced model from day one

## Decision 4: Support zoom and scrubbing through direct panel interaction

- Decision: Scrubbing happens by clicking the ruler; zoom happens with
  `Shift + wheel`; the plain wheel remains scroll.
- Rationale: This matches the target animation-style UX and keeps the visible
  panel free of extra sliders or help text.
- Alternatives considered:
  - Visible zoom slider
  - Timeline slider for transport
  - Wheel-only zoom behavior

## Decision 5: Model keyframes by property now, but keep UI minimal

- Decision: Store property channels and keyframes in the data model now, while
  keeping the first UI release focused on tracks, clips, transport, and scrubbing.
- Rationale: This avoids redesign later when property animation lanes are added.
- Alternatives considered:
  - Omit keyframe data until the UI is ready
  - Treat keyframes as clip-level metadata only

## Decision 6: Treat connected engine support as optional at runtime

- Decision: The timeline should run in demo mode without an engine while being
  able to reflect current time and transport state when an engine exists.
- Rationale: The shell must stay usable in a static build even when the engine
  is absent.
- Alternatives considered:
  - Block timeline usability until the engine connects
  - Hard-couple the panel to live engine messages only
