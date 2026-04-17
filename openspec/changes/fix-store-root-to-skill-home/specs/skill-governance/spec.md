## MODIFIED Requirements

### Requirement: Apply And Roll Back Governance State
The system SHALL support auditable apply and rollback flows for governance artifacts, and the default governance store SHALL be owned by the installed `skill-governor` skill rather than the governed project root.

#### Scenario: Apply a plan without polluting the governed workspace
- **WHEN** the user runs `skill-governor apply --plan <plan-id>` without `--store-root`
- **THEN** the system SHALL resolve the default store under the installed `skill-governor` skill home
- **AND** the system SHALL write the selected scope under `<skill-home>/.skill-governor/<scope>/`
- **AND** the system SHALL NOT create or require `.skill-governor/` in the governed project directory

#### Scenario: Roll back from the skill-owned governance store
- **WHEN** the user runs `skill-governor rollback` without `--store-root`
- **THEN** the system SHALL read snapshots from the scope-specific store under the skill home
- **AND** restore governance state from that skill-owned store

### Requirement: Support Governance Profiles And Explicit Scope Selection
The system SHALL support reusable governance profiles and explicit logical scope selection while storing governance artifacts under the installed `skill-governor` skill home by default.

#### Scenario: Use workspace scope without changing storage ownership
- **WHEN** the user selects `--scope workspace`
- **THEN** the system SHALL treat `workspace` as the logical governance scope
- **AND** store artifacts under `<skill-home>/.skill-governor/workspace/`
- **AND** not treat the governed project root as the default storage owner

#### Scenario: Use user scope without writing into the governed project
- **WHEN** the user selects `--scope user`
- **THEN** the system SHALL store artifacts under `<skill-home>/.skill-governor/user/`
- **AND** continue to keep raw provider skill files unchanged

### Requirement: Detect Legacy Workspace-Local Stores
The system SHALL detect legacy workspace-local `.skill-governor/` stores created by earlier versions and surface migration guidance.

#### Scenario: Legacy workspace-local store exists
- **WHEN** the system resolves the default skill-owned store
- **AND** a legacy `.skill-governor/` directory exists under the governed project root
- **THEN** the system SHALL detect that legacy store
- **AND** provide migration guidance or a safe migration path
- **AND** avoid silently continuing with a stale or split state
