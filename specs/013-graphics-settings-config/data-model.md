# Data Model: Graphics Settings Config

## GraphicsConfig

Represents the complete editable graphics configuration.

Fields:

- `context: GraphicsContextSettings`
- `fbos: FboConfigRow[]`

Validation:

- Must contain exactly 25 FBO rows.
- FBO indexes must cover `0..24` exactly once.

## GraphicsContextSettings

Fields:

- `colorDepth: number`
- `width: number`
- `height: number`
- `fullscreen: boolean`
- `vsync: boolean`
- `targetFps: number | null`

Validation:

- `width` and `height` must be positive integers.
- `colorDepth` must be one of the supported dialog options.
- `targetFps` is required when V-sync is shown as a fixed refresh value such as `60 fps`.

## FboConfigRow

Fields:

- `index: number`
- `ratio: number | null`
- `format: string`
- `width: number | null`
- `height: number | null`
- `attachments: number`
- `filter: "bilinear" | "none"`

Validation:

- `index` is an integer from `0` through `24`.
- Rows `0..19` require positive `ratio`.
- Rows `20..24` require positive `width` and `height`.
- `format` must be one of the supported Phoenix format names.
- `attachments` must be a positive integer accepted by Phoenix.

## GraphicsDialogDraft

Temporary in-dialog copy of `GraphicsConfig`.

Lifecycle:

1. Created when the panel opens from project data or defaults.
2. Mutated while the user edits controls.
3. Discarded on Cancel.
4. Validated and committed on OK.

## GraphicsSyncResult

Represents Phoenix's response to OK.

Fields:

- `ok: boolean`
- `requestId: string`
- `config?: GraphicsConfig`
- `warnings?: GraphicsWarning[]`
- `code?: string`
- `message?: string`
- `details?: GraphicsErrorDetail[]`

