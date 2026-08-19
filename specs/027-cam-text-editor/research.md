# Research: CAM Text Editor With Column Highlighting

## Decision 1: Reuse The Existing Monaco Editor Surface

The GLSL asset editor already establishes the project patterns for one floating editor per asset, UTF-8 decoding, dirty-state persistence, Undo registration, Phoenix asset writes, Events, and Timeline error updates. The CAM editor will be a dedicated panel using the same Monaco runtime and visual shell, without the GLSL-only transient Preview action.

**Alternatives considered**:

- A textarea was rejected because it would lose the existing editor behavior and decoration APIs.
- Extending the GLSL language tokenizer was rejected because CAM column position is line-dependent and not GLSL syntax.

## Decision 2: Compute Columns With A Pure Scanner And Render Decorations

A pure browser utility will scan every line and return each non-space/tab span with its line, range, and zero-based column index. Monaco decorations will map those ranges to a deterministic finite palette. The palette cycles for unusually wide rows, but adjacent columns always use different colors.

The scanner treats `[ \t]+` as one separator, ignores leading/trailing separators, accepts irregular row widths and arbitrary token text, and never rewrites source content.

**Alternatives considered**:

- Monarch state cannot conveniently count an arbitrary number of columns independently on every line.
- Parsing numeric values would introduce validation and normalization semantics not requested by the feature.

## Decision 3: Reuse Scoped Persisted Asset Impact

Phoenix's existing `PUT /api/assets/file` endpoint is extension-agnostic. With `reloadSections` enabled it writes the file atomically, resolves the exact normalized asset path through its dependency index, attempts every dependent section independently, and returns `reloadedSections`, `deactivatedSections`, and `failedSections`.

Cacablu will call this operation only when the CAM file's current database row is enabled and Phoenix is connected. Existing asset-impact handling will clear resolved errors and mark/report failures. Disabled saves remain local; enabled offline saves remain local and emit one warning.

## Decision 4: Generalize The Existing File-Content Undo Helper

The content snapshot and Undo mechanics are not GLSL-specific. They will be exposed from a generic resource-file editor helper, while the previous GLSL module remains as a compatibility re-export. CAM Undo will restore exact prior bytes and will only write the restored file to Phoenix when the restored asset is enabled.

## Decision 5: No New Runtime Dependency Or Phoenix Change

Monaco, Dockview, the project database session, Phoenix client, and Events/Timeline impact handlers already exist. The implementation requires no package addition, database migration, new endpoint, or Phoenix source modification.
