# Implementation Plan: Phoenix Connection Indicator

**Branch**: `017-phoenix-connection-indicator` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

## Summary

Add a shared browser-side Phoenix activity signal and drive a CSS glow on the existing connection badge. Use immediate state escalation and time-based decay, with slow idle pulsing and reduced-motion styling.

## Technical Context

**Language/Version**: TypeScript 5.x and CSS  
**Dependencies**: Existing connection controller, HTTP clients, WebSocket transport  
**Storage**: N/A  
**Testing**: Focused state tests and Playwright  
**Platform**: Modern browser  
**Constraints**: No rotating decoration, no Phoenix API change, minimal per-message work

## Constitution Check

- Browser-only static behavior is preserved.
- Communication instrumentation is constant-time and does not delay messages.
- Reduced-motion accessibility is explicit.
- Existing engine contracts remain unchanged.

## Project Structure

```text
src/phoenix/activity.ts
src/app/shell.ts
src/styles/app.css
scripts/playwright-connection-badge-check.mjs
```

## Implementation Approach

1. Publish activity at shared send/receive boundaries.
2. Subscribe the badge to connection and activity state.
3. Apply immediate glow peaks, gradual decay, idle pulse, and reduced-motion rules.
4. Verify visual state transitions in Chromium.
