## MODIFIED Requirements

### Requirement: Initial project bar synchronization
Cacablu SHALL synchronize project database bars to Phoenix runtime sections when a project opens and SHALL force full replacement after Phoenix reconnects.

#### Scenario: Project bars already match Phoenix sections during ordinary project open
- **WHEN** Cacablu opens a project outside reconnect recovery and the serialized project bars exactly match Phoenix's section manifest
- **THEN** Cacablu does not ask Phoenix to delete or recreate sections
- **AND** Phoenix keeps the existing runtime sections.

#### Scenario: Project bars differ from Phoenix sections
- **WHEN** Cacablu opens a project and Phoenix has any missing, extra, or changed section relative to the serialized project bars
- **THEN** Cacablu sends a full section replacement request to Phoenix
- **AND** Phoenix deletes all current runtime sections
- **AND** Phoenix creates runtime sections for every project bar in the request
- **AND** Phoenix writes one root `.spo` file under the active `data` folder for every received section
- **AND** Phoenix rebuilds the section load/execution queues using the existing section pipeline.

#### Scenario: Reconnect forces full section replacement
- **WHEN** Cacablu synchronizes an open project after Phoenix reconnects
- **THEN** Cacablu SHALL call the full section replacement operation even if Phoenix's section manifest appears equal
- **AND** Phoenix SHALL remove stale editor-published root `.spo` files
- **AND** Phoenix SHALL recreate runtime sections and root `.spo` files from every current enabled project bar.

#### Scenario: Section sync follows asset sync
- **WHEN** a project synchronization requires both asset uploads and section replacement
- **THEN** Cacablu completes the asset and project-settings phases before requesting section replacement
- **AND** section scripts that reference published assets can resolve current files from Phoenix's active `data` folder.
