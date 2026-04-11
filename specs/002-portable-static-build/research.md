# Research: Portable Static Build

## Decision: Treat the built output, not the source entry file, as the portable artifact

**Rationale**: Browsers execute JavaScript, not raw TypeScript source. The
portable experience should therefore target the generated build output rather
than the development entry file.

**Alternatives considered**:
- Making the source `index.html` work directly by double click: rejected because
  it conflicts with the current TypeScript-based source workflow.

## Decision: Emit relative asset paths in the built output

**Rationale**: Relative asset paths are required if the build folder is moved to
another location and still needs to work from `file://`.

**Alternatives considered**:
- Root-relative asset paths: rejected because they break when opened from the local filesystem.

## Decision: Preserve both local opening and normal static hosting

**Rationale**: The project constitution requires static deployability in general,
not only local filesystem opening. The packaging solution must therefore support
both.

**Alternatives considered**:
- A packaging flow that only targets local opening: rejected because it narrows deployment flexibility.

## Decision: Document local runtime limits explicitly

**Rationale**: Some browser behaviors differ under `file://`, especially around
resource access and integrations. The app should communicate limits clearly
instead of failing ambiguously.

**Alternatives considered**:
- No visible explanation of runtime limits: rejected because it makes debugging local-open behavior harder.

## Decision: Expose explicit npm commands for all three usage modes

**Rationale**: The workflow should be obvious and repeatable: `dev` for
development, `package` for generating the portable build artifact, and `preview`
for serving the built output over HTTP.

**Alternatives considered**:
- Expecting developers to infer the workflow from generic commands alone:
  rejected because it is less explicit and easier to misuse.
