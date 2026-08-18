# Research: About Panel

## Decision: Embed Git Metadata Through Vite

Vite configuration runs in Node before development serving and production bundling, so it can safely execute `git log` once and replace a client constant. The browser receives a plain string and performs no process or filesystem access.

### Alternatives Rejected

- Runtime Git command: browsers cannot execute Git and it would break static deployment.
- Fetching a generated metadata file: adds an unnecessary runtime request and another deployable asset.
- Build completion time: does not identify the latest source commit requested by the user.
- Package version only: lacks the required date and time.

## Decision: Use Committer Date In Build-Environment Local Time

Git's committer timestamp identifies when the latest commit was recorded. Formatting it through Git with local-time output provides the required zero-padded representation without adding a date library.

## Decision: Reuse The Existing Docked Panel Path

About is a normal panel definition opened with `workspace.openPanel('about')`. The workspace already focuses an existing panel with the same id, satisfying the no-duplicates requirement.

