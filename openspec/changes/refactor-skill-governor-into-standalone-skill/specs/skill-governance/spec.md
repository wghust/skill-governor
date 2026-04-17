## MODIFIED Requirements

### Requirement: Provide A Natural-Language Governance Entry Skill
The system SHALL provide `skill-governor` as a standalone skill package whose primary interface is the repository-root `SKILL.md`.

#### Scenario: Use the repository root skill file as the primary interface
- **WHEN** a user asks to audit, optimize, apply, roll back, or activate governance behavior
- **THEN** the system SHALL treat the repository-root `SKILL.md` as the primary skill interface
- **AND** the skill SHALL map the request to controlled CLI execution
- **AND** the repository SHALL NOT require the skill definition to live under `.codex/skills/skill-governor/`

### Requirement: Package The Execution Engine Under cli
The system SHALL package the deterministic execution engine and its scaffolding under the `cli/` directory.

#### Scenario: Organize execution assets under cli
- **WHEN** the repository is inspected as a standalone skill package
- **THEN** the execution engine source, tests, examples, and package configuration SHALL live under `cli/`
- **AND** the repository SHALL expose `SKILL.md` and `cli/` as the two primary top-level product modules

#### Scenario: Preserve governance behavior after CLI relocation
- **WHEN** the CLI is run from its relocated `cli/` package structure
- **THEN** the system SHALL continue to support discovery, planning, apply, rollback, profile activation, and reporting
- **AND** raw provider skill files SHALL remain read-only
