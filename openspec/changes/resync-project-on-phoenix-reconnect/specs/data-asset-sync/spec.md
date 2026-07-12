## MODIFIED Requirements

### Requirement: Initial published pool synchronization
Cacablu SHALL synchronize enabled project pool files to Phoenix when a project opens or Phoenix reconnects, using exact manifest comparison to avoid unnecessary transfer.

#### Scenario: Published pool already matches Phoenix during ordinary project open
- **WHEN** Cacablu opens a project outside reconnect recovery and Phoenix's `pool` file manifest has exactly the same enabled file paths, sizes, and hashes
- **THEN** Cacablu does not delete or upload pool files
- **AND** Cacablu may mark those files as already present.

#### Scenario: Published pool differs from Phoenix
- **WHEN** Cacablu opens a project and Phoenix's `pool` file manifest has any missing, extra, or size-mismatched file relative to the enabled project files
- **THEN** Cacablu deletes Phoenix's `pool` directory recursively
- **AND** Cacablu recreates `pool`
- **AND** Cacablu uploads every enabled project pool file.

#### Scenario: Reconnect finds identical pool content
- **WHEN** Cacablu synchronizes an open project after Phoenix reconnects
- **AND** Phoenix's pool paths, sizes, and hashes exactly match the enabled project assets
- **THEN** Cacablu SHALL NOT delete or upload pool content.

#### Scenario: Reconnect finds different pool content
- **WHEN** Cacablu synchronizes an open project after Phoenix reconnects
- **AND** any Phoenix pool path, size, or hash differs from the enabled project assets
- **THEN** Cacablu deletes the managed Phoenix pool recursively
- **AND** Cacablu recreates it and uploads every enabled project asset from the current project snapshot.

#### Scenario: Initial sync is cancelled
- **WHEN** the user cancels the initial project pool synchronization
- **THEN** Cacablu aborts the in-flight request when possible
- **AND** Cacablu does not publish the newly opened project session to the workspace
- **AND** Cacablu remains without a loaded pool for that project.

### Requirement: Cacablu and Phoenix data ownership boundary
Cacablu SHALL fully replace content it owns without deleting Phoenix bootstrap content that the project cannot recreate.

#### Scenario: Reconnect synchronization clears differing managed content
- **WHEN** reconnect asset comparison finds differing content
- **THEN** Cacablu clears enabled-project asset destinations through scoped Phoenix APIs
- **AND** stale managed files from an earlier project version are removed.

#### Scenario: Phoenix-owned bootstrap content is present
- **WHEN** reconnect synchronization clears differing managed content
- **THEN** Phoenix SHALL preserve bootstrap or installation-owned files not represented by the Cacablu project
- **AND** Phoenix remains startable after the synchronization.
