# Research: Delete Selected Timeline Bars

## Existing Behavior

- Cacablu already represents single and multiple bar selections in shared app state.
- The Timeline panel contained partial deletion logic, but command ownership depended on panel lifecycle.
- `DbSession.deleteTimelineBars` already deletes all resolved ids with one SQL statement and snapshots complete `DbBar` rows before mutation.
- The shared Undo manager supports asynchronous Undo and restores a failed action to its stack.
- Phoenix already exposes `deleteMany(ids)` and `replaceOne(section)` through the section client.
- `syncProjectBarToPhoenix` already applies enabled/publication filtering and returns structured section issues.

## Decisions

### Global command ownership

The application shell owns bar deletion so the command works whenever project bars are selected, regardless of whether Timeline is mounted. Timeline retains marker-specific deletion only.

### Local-first commit

SQLite and in-memory project state commit before Phoenix synchronization. Phoenix availability cannot block local editing, and connected failure does not roll back the user's project.

### Complete snapshots

Undo stores cloned `DbBar` rows rather than ids or a cache reference. The snapshot includes stable id, name, type, layer, times, flags, script, blend values, and alpha values.

### Transactional restoration

Restoration preflights duplicate/conflicting ids, inserts every row inside one explicit transaction, rolls back on error, and mutates the in-memory array only after commit.

### Targeted Phoenix operations

Deletion uses one `deleteMany`; Undo reuses `syncProjectBarToPhoenix` per eligible restored bar. A full project replacement would touch unrelated sections and increase latency.

### Ordered immediate Undo

The Undo action awaits the deletion promise before publishing restored sections. This prevents a late delete response from removing a section that Undo had already recreated.

## Alternatives Rejected

- **Timeline-local keyboard handler**: fails when the panel is closed and duplicates application routing.
- **Full section replacement**: broader runtime impact than known-id delete/update operations.
- **Wait for Phoenix before local commit**: makes editing depend on engine availability.
- **Restore bars one by one through the public insert method**: can leave partial rows when a later insert conflicts.
- **Store ids only for Undo**: deleted rows cannot reconstruct their content.
- **Add a new Phoenix endpoint**: existing section APIs already express the required mutations.
