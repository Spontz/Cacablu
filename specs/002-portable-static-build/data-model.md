# Data Model: Portable Static Build

## PortableBuildOutput

**Purpose**: Represents the generated application package intended for local opening or static hosting.

**Fields**:
- `entryHtml`: string
- `assetPaths`: string[]
- `portable`: boolean

**Validation Rules**:
- `entryHtml` must point to the generated browser entry file.
- `assetPaths` must resolve through relative references suitable for local opening.

## AssetReference

**Purpose**: Describes a built asset link required by the generated app.

**Fields**:
- `sourceFile`: string
- `targetFile`: string
- `pathKind`: `relative | root`

**Validation Rules**:
- `pathKind` must be `relative` for portable build output.

## RuntimeLimitationNotice

**Purpose**: Represents a user-facing explanation of local-open behavior or limitations.

**Fields**:
- `visible`: boolean
- `message`: string
- `condition`: string

**Validation Rules**:
- The message must be non-blocking and understandable by users.
