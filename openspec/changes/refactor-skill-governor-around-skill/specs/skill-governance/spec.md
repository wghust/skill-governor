## MODIFIED Requirements

### Requirement: Provide A Natural-Language Governance Entry Skill
The system SHALL provide a project-local `skill-governor` skill that serves as the primary user-facing interface for skill governance, maps natural-language governance requests to allowlisted CLI commands, and summarizes structured results.

#### Scenario: Route a governance request through the project-local skill
- **WHEN** the user asks to audit, optimize, apply, roll back, or activate a governance profile
- **THEN** the system SHALL treat the project-local `skill-governor` `SKILL.md` as the primary entrypoint
- **AND** map the request to a controlled CLI command
- **AND** summarize the CLI result back to the user

#### Scenario: Require confirmation before apply
- **WHEN** the user makes a request that would persist governance changes
- **THEN** the skill SHALL invoke a dry-run or read-only CLI command first
- **AND** summarize the planned changes
- **AND** ask the user for confirmation before running `apply`

### Requirement: Use The CLI As The Execution Engine
The system SHALL use the `skill-governor` CLI as the deterministic execution engine behind the entry skill rather than as the primary product interface.

#### Scenario: Execute governance logic after skill intent mapping
- **WHEN** the entry skill resolves a governance intent
- **THEN** the system SHALL execute the corresponding CLI command
- **AND** the CLI SHALL handle discovery, planning, apply, rollback, profile activation, and reporting
- **AND** raw provider skill files SHALL remain read-only

#### Scenario: Keep the CLI available for automation
- **WHEN** testing or automation needs to invoke governance behavior directly
- **THEN** the system SHALL continue to expose the CLI commands
- **AND** project documentation SHALL describe those commands as the execution surface behind the skill
