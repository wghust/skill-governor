## MODIFIED Requirements

### Requirement: Provide A Natural-Language Governance Entry Skill
The system SHALL support a minimal user-facing distribution in which the governance skill is delivered as `SKILL.md` plus a runtime executable at `bin/skill-governor`.

#### Scenario: Use the runtime distribution without the source tree
- **WHEN** the skill is distributed to an end user
- **THEN** the user-facing package SHALL include `SKILL.md`
- **AND** the package SHALL include `bin/skill-governor`
- **AND** the package SHALL NOT require the full `cli/` source tree for basic runtime usage

### Requirement: Provide A Single-File Node Runtime Entry
The system SHALL package the runtime executor as a single-file Node executable script.

#### Scenario: Invoke the packaged runtime entrypoint
- **WHEN** the skill needs to execute a governance action in the user-facing distribution
- **THEN** it SHALL invoke `bin/skill-governor`
- **AND** that file SHALL serve as the runtime entrypoint for discovery, planning, apply, rollback, profile activation, and reporting
- **AND** the runtime entrypoint SHALL preserve the existing governance semantics

#### Scenario: Preserve the development package separately
- **WHEN** maintainers work on the project
- **THEN** the development repository SHALL continue to keep implementation code under `cli/`
- **AND** the runtime distribution SHALL remain a separate, smaller surface built from that development package
