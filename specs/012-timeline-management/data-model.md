# Data Model: Timeline Management

## Timeline Bar

Represents a row in the project `BARS` table and its visual clip.

Fields:
- `id`: stable numeric database id
- `type`: Phoenix section type string
- `layer`: numeric layer track
- `startTime`: seconds
- `endTime`: seconds
- `enabled`: whether the section is active
- `selected`: database/UI selection flag when applicable
- `script`: raw Phoenix section body
- `srcBlending`, `dstBlending`, `blendingEQ`: render metadata
- `srcAlpha`, `dstAlpha`: existing database metadata retained unchanged unless edited

Validation:
- `id` must be stable and unique.
- `startTime` must be `>= 0`.
- `endTime` must be greater than `startTime`.
- `layer` must be finite.
- `blendingEQ` is stored as a Phoenix-compatible value. The editor presents `Add`, `Subtract`, and `Reverse subtract`, mapped to `ADD`, `SUBTRACT`, and `REVERSE_SUBTRACT`.

## Section Editor State

Represents the selected bar editing surface.

Fields:
- `selectedBarId`: current timeline bar id from shared app selection.
- `barType`: selected bar type control value.
- `scriptTemplate`: selected script template name.
- `script`: editable section script text.
- `srcBlending`: source blend function.
- `dstBlending`: destination blend function.
- `blendingEQ`: blend equation.

Rules:
- Single-clicking a timeline bar opens or reinitializes the Section Editor, including repeated clicks on the same bar.
- Applying edits updates the loaded project session before any Phoenix sync attempt.
- Opening without a project or without a selected bar shows an empty state rather than blocking the panel.

## Timeline Track

Represents one visible layer lane.

Fields:
- `id`: derived from layer number
- `layer`: numeric project layer
- `label`: display text
- `order`: sorted visual order

Tracks are derived from bars. No project means no tracks.

## Timeline Edit Transaction

Represents a committed edit operation.

Types:
- `create`
- `update-time`
- `update-layer`
- `resize`
- `delete`
- `update-properties`

Fields:
- `barId`
- `before` when available
- `after` when available
- `committedAt`

## Timeline Sync State

Tracks Phoenix synchronization after local commits.

States:
- `idle`
- `pending`
- `syncing`
- `disconnected`
- `error`

Sync state is not the source of truth for edits; it only describes engine alignment.

Known bar-level section sync errors are derived from Events with a bar `subjectId`. Bars with known errors are displayed in red while those Events remain present.
