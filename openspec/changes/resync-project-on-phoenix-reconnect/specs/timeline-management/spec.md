## MODIFIED Requirements

### Requirement: Timeline-to-Phoenix section synchronization
Cacablu SHALL synchronize committed timeline bar changes to Phoenix using the existing project bar to section synchronization pathway and SHALL automatically perform full project synchronization after reconnect.

#### Scenario: Timeline edit is committed while Phoenix is connected
- **WHEN** the user commits a timeline bar create, update, move, resize, layer change, or delete
- **THEN** Cacablu schedules a Phoenix section synchronization
- **AND** Phoenix receives the current project bar snapshot after debouncing intermediate timeline changes.

#### Scenario: Bar move is synchronized to disk
- **WHEN** Phoenix receives a deferred single-section synchronization after a bar move
- **THEN** Phoenix rewrites only the `.spo` file for the moved bar id with updated timing and layer metadata
- **AND** Phoenix updates that runtime section without requiring a full section replacement.

#### Scenario: Transport follows a bar move
- **WHEN** the user presses Play immediately after committing a bar move
- **THEN** Cacablu gives the transport command priority over the deferred section sync
- **AND** Play is not delayed by section replacement work.

#### Scenario: Timeline edit is committed while Phoenix is disconnected
- **WHEN** the user commits a timeline bar edit and Phoenix is not connected
- **THEN** Cacablu keeps the local project edit
- **AND** Cacablu does not send a Phoenix request.

#### Scenario: Project opens while Phoenix is disconnected
- **WHEN** the user opens a project and Phoenix is not connected
- **THEN** Cacablu skips initial Phoenix pool and section synchronization
- **AND** the project loads locally without attempting Phoenix fetch requests
- **AND** Cacablu does not create disconnected-sync error events for that skipped initial sync.

#### Scenario: Phoenix connects after project open
- **WHEN** Phoenix connects after Cacablu already has a project loaded
- **THEN** Cacablu automatically starts a forced full project synchronization
- **AND** Cacablu does not ask the user to confirm loading the project into Phoenix.

#### Scenario: Phoenix rejects synchronized bars
- **WHEN** Phoenix returns section sync errors after a timeline edit
- **THEN** Cacablu records those errors in the Events panel
- **AND** Cacablu keeps the local timeline edit available for further correction.

#### Scenario: Phoenix identifies failed sections
- **WHEN** Phoenix cannot load one or more synchronized sections
- **THEN** the section sync response includes failed section ids and messages
- **AND** Cacablu can associate those failures with timeline bars.

#### Scenario: Section sync progress is displayed
- **WHEN** Cacablu can count local section preparation or manifest checking work
- **THEN** the sync modal advances its label and progress bar using actual processed counts
- **AND** one-shot Phoenix HTTP requests do not display stale partial counters or reset the progress bar to zero.

#### Scenario: Timeline displays section errors
- **WHEN** Cacablu has tracked section error ids from section sync or asset impact responses
- **THEN** matching timeline bars are colored red until those ids are cleared by successful resync or project reset.
