# Data Model: GLSL Asset Editor Hot Reload

## AssetEditorDraft

- `assetId`: Project DB identifier for the asset.
- `path`: Normalized project asset path, matching Phoenix `pool/...` or `resources/...`.
- `language`: `glsl` for `.glsl` assets.
- `originalContent`: UTF-8 text loaded from the project DB when the editor opens or after save.
- `draftContent`: Current Monaco editor text.
- `dirty`: True when `draftContent` differs from `originalContent`.
- `lastPreviewHash`: Optional hash of the last draft successfully previewed in Phoenix.
- `lastPhoenixImpact`: Optional latest `AssetImpactResult`.

## AssetImpactResult

- `requestId`: Request identifier echoed by Phoenix.
- `operation`: `preview-asset`, `write-file`, `delete-file`, `unpublish-file`, or `move-file`.
- `path`: Normalized affected path.
- `persisted`: True when Phoenix disk was written.
- `reloadedSections`: Section summaries reloaded successfully.
- `deactivatedSections`: Section summaries deactivated because the asset is unavailable.
- `failedSections`: Section summaries that failed reload or deactivate handling.

## SectionImpactSummary

- `id`: Phoenix/Cacablu bar or section ID.
- `type`: Optional Phoenix section type.
- `message`: Optional diagnostic text.

## SectionImpactEvent

- `severity`: `info`, `warning`, or `error`.
- `description`: Human-readable description containing affected asset path and section IDs.
- `source`: `asset-preview`, `asset-save`, `asset-delete`, `asset-unpublish`, or `asset-move`.
