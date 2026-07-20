# Contract: Timeline Bar Deletion Synchronization

## Scope

This feature reuses the existing Phoenix editor section API. It introduces no endpoint or payload change.

## Delete Selected Bars

**Request**

```http
DELETE /api/sections
Content-Type: application/json

{
  "requestId": "<generated-id>",
  "ids": ["17", "23"]
}
```

**Required behavior**

- Cacablu sends one request after local deletion commits.
- `ids` contains each deleted stable bar id once.
- Phoenix removes only matching runtime sections.
- Phoenix removes matching editor-owned root `<id>.spo` files when present.
- Phoenix leaves unrelated runtime sections and `.spo` files unchanged.
- Phoenix returns its existing structured `delete-many` result and publishes the existing section-change event.

## Restore Deleted Bars

For every restored bar eligible under current publication rules, Cacablu reuses:

```http
PUT /api/sections/section
Content-Type: application/json

{
  "requestId": "<generated-id>",
  "sections": ["<existing PhoenixSectionPayload>"]
}
```

Disabled or otherwise excluded bars remain in the Cacablu project and are not sent.

## Ordering

When Undo occurs before the delete request settles:

1. Cacablu restores the local database transaction immediately.
2. Cacablu waits for the deletion synchronization promise to settle.
3. Cacablu sends eligible restored sections.

The final attempted Phoenix state therefore matches the restored local state.

## Failure And Degraded Behavior

- Disconnected: skip requests and do not emit disconnected-sync errors.
- Delete failure: retain local deletion and record Events/section errors for all affected ids.
- Restore failure: retain local restoration and record Events/section errors for affected ids.
- Unsupported/invalid restored bar: retain the local bar and report the existing structured section issue.
- Later reconnect/project synchronization may reconcile Phoenix with the authoritative project.
