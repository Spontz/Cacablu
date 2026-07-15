# Feature Specification: Phoenix Connection Indicator

**Feature Branch**: `017-phoenix-connection-indicator`  
**Created**: 2026-07-15  
**Status**: Implemented  
**Input**: Show a connected glow that pulses slowly when idle and reacts immediately to Phoenix communication.

## Runtime Context

**Browser Surface**: Phoenix connection badge in the top application bar.  
**Local Engine Dependency**: Optional; engine communication drives activity emphasis when connected.  
**Static Deployment Impact**: CSS and browser event state only.  
**Real-Time Sensitivity**: Activity flashes must react immediately while fade-out remains gradual.  
**File System Access Requirement**: None for this feature.

## User Scenarios & Testing

### User Story 1 - Recognize A Live Phoenix Connection (Priority: P1)

The connected badge has a green border glow with a restrained slow idle pulse.

**Independent Test**: Connect and disconnect Phoenix and inspect the badge state and animation classes.

**Acceptance Scenarios**:

1. **Given** Phoenix is connected, **When** no traffic occurs, **Then** the green glow pulses slowly without a rotating halo.
2. **Given** Phoenix disconnects or errors, **When** status changes, **Then** connected animation disappears immediately.

### User Story 2 - See Communication Activity (Priority: P1)

The badge brightens immediately for sent or received Phoenix traffic and fades gradually afterward like a disk-activity light.

**Independent Test**: Trigger HTTP and WebSocket traffic and verify immediate peak brightness followed by gradual decay.

## Requirements

- **FR-001**: Connected state MUST show a green border glow.
- **FR-002**: Idle connected state MUST pulse slowly and MUST NOT use a rotating halo.
- **FR-003**: Phoenix send/receive activity MUST increase brightness immediately and accelerate activity pulses.
- **FR-004**: Activity brightness MUST decay gradually after the interaction.
- **FR-005**: Disconnect and error MUST remove connected animation immediately.
- **FR-006**: Reduced-motion mode MUST retain a static connected glow and non-motion activity emphasis.
- **FR-007**: The feature MUST instrument shared HTTP and WebSocket boundaries without changing Phoenix contracts.

## Success Criteria

- **SC-001**: Browser tests observe idle, active, disconnected, error, and reduced-motion states.
- **SC-002**: Activity becomes visible in the next rendered frame and decays without abrupt shutoff.
- **SC-003**: Typecheck, lint, and build pass without Phoenix changes.

## Assumptions

- The connection badge remains a status label, not a progress indicator.
