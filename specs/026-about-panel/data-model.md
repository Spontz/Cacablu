# Data Model: About Panel

## Build Revision Timestamp

```text
BuildRevisionTimestamp
`-- value: string  # YYYY-MM-DD HH:MM:SS
```

## Invariants

- The value is derived from the latest Git commit's committer date.
- The value matches `YYYY-MM-DD HH:MM:SS` before Vite embeds it.
- The value is immutable for the lifetime of one served or built client bundle.
- The browser never queries Git or transforms the timestamp.
- The About panel renders this value without additional product metadata.

