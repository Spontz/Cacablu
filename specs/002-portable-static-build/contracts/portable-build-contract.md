# Portable Build Contract

## Purpose

Define the expected behavior of the built application package when opened either
from a local filesystem path or from a normal static HTTP host.

## Build Output Expectations

- The generated output must contain a browser entry HTML file.
- The generated output must include all required scripts and styles for the shell.
- Asset references required by the entry HTML must resolve through relative paths.
- The repository must expose a documented command that produces this portable output.

## Runtime Expectations

- Opening the built entry HTML locally must render the shell.
- Opening the same output from a static server must continue to work.
- The shell must remain usable without an active visuals engine connection.
- The repository must expose a documented command that previews the built output
  over HTTP.

## Failure Expectations

- If a capability is unavailable due to local-open browser restrictions, the app
  should surface a clear non-blocking notice instead of failing silently.
