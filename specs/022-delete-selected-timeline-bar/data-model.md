# Data Model: Delete Selected Timeline Bars

## Existing Entity: Timeline Bar

The feature does not change the SQLite schema. A deletion snapshot preserves the existing `DbBar` fields:

| Field | Type | Restoration rule |
|------|------|------------------|
| `id` | number | Restore exactly; reject conflicts |
| `name` | string | Restore exactly |
| `type` | string | Restore exactly |
| `layer` | number | Restore original numeric layer |
| `startTime` | number | Restore exact interval start |
| `endTime` | number | Restore exact interval end |
| `enabled` | boolean | Restore publication state |
| `selected` | boolean | Restore persisted field; shared UI selection is also restored |
| `script` | string | Restore exact section body |
| `srcBlending` | string | Restore exactly |
| `dstBlending` | string | Restore exactly |
| `blendingEQ` | string | Restore exactly |
| `srcAlpha` | string | Restore exactly |
| `dstAlpha` | string | Restore exactly |

## Bar Deletion Result

```text
BarDeletionResult
|-- deletedBars: DbBar[]  # immutable clones ordered by stable id
`-- deletedIds: number[]  # ids sent to Phoenix and restored in selection
```

## State Transitions

```text
selected existing bars
        |
        v
snapshot -> atomic delete -> clear selection -> Timeline refresh
        |                         |
        |                         `-> Phoenix deleteMany when connected
        v
one Undo entry
        |
        v
conflict preflight -> transactional restore -> reselection -> Timeline refresh
                                                     |
                                                     `-> wait deleteMany, then replaceOne eligible bars
```

## Invariants

- One deletion command creates at most one Undo entry.
- Snapshot ids are unique.
- No in-memory deletion occurs before the SQL delete succeeds.
- No restored row reaches in-memory state before the restoration transaction commits.
- A restoration conflict leaves all other snapshots deleted.
- Phoenix synchronization never determines whether the local mutation is committed.
