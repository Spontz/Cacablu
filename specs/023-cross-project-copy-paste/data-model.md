# Data Model: Cross-Project Copy And Paste

## Clipboard Envelope

```text
CacabluClipboardEnvelope
|-- app: "cacablu"
|-- version: 1
|-- kind: "bars" | "pool"
|-- createdAt: ISO timestamp
`-- payload: BarClipboardPayload | PoolClipboardPayload
```

## Bar Clipboard Payload

```text
BarClipboardPayload
|-- anchorStart: number       # minimum copied startTime
|-- anchorLayer: number       # minimum copied layer
`-- bars: BarClipboardEntry[]

BarClipboardEntry
|-- sourceId: number          # provenance only
|-- name/type
|-- startTime/endTime/layer
|-- enabled
|-- script
|-- srcBlending/dstBlending/blendingEQ
`-- srcAlpha/dstAlpha
```

Destination transformation:

```text
newStart = targetTime + (sourceStart - anchorStart)
newEnd   = newStart + (sourceEnd - sourceStart)
newLayer = targetLayer + (sourceLayer - anchorLayer)
```

Destination ids are allocated by the destination SQLite database. UI selection becomes the newly allocated ids.

## Pool Clipboard Payload

```text
PoolClipboardPayload
`-- roots: PoolClipboardNode[]

PoolClipboardFolder
|-- kind: "folder"
|-- sourceId/name/path/enabled
`-- children: PoolClipboardNode[]

PoolClipboardFile
|-- kind: "file"
|-- sourceId/name/path
|-- bytes/type/format/enabled
`-- dataBase64
```

Decoded files become existing `AssetClipboardFile` nodes with independent `Uint8Array` data.

## Timeline Paste Target

```text
TimelinePasteTarget
|-- layer: number | null      # shared per active project session
`-- time: current Timeline transport time
```

The layer is explicit and visually persistent. Time is derived from Timeline current time so ruler, scrub, seek, and transport updates remain authoritative.

## Paste Batch

```text
DestinationPasteBatch
|-- kind: "bars" | "pool"
|-- destinationIds
|-- immutable post-insert snapshots
`-- source envelope metadata
```

One batch maps to one Undo entry. Undo validates that pasted entities have not changed incompatibly before removing them atomically.

## Invariants

- Envelope decoding never mutates project state.
- Source ids never become destination primary keys.
- One Paste is all-or-nothing.
- Relative bar time/layer relationships are stable.
- Pool bytes and declared byte counts match after decode.
- Context kind must match payload kind.
- Undo changes only destination entities.
