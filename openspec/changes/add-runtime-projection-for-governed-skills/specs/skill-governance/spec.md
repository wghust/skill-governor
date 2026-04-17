## ADDED Requirements

### Requirement: Derive An Effective Runtime Skill Set
The system SHALL derive an effective runtime skill set from the discovered registry, active governance state, active profile, and duplicate resolution outcomes.

#### Scenario: Resolve effective skills after governance apply
- **WHEN** the user has applied a governance plan
- **AND** an active profile exists in `.skill-governor/state.json`
- **THEN** the system SHALL compute the effective included and excluded skills for each supported provider
- **AND** the resolved result SHALL reflect governance mode, priority, and duplicate-primary or duplicate-secondary outcomes

#### Scenario: Exclude duplicate secondary skills from the effective set
- **WHEN** a skill is classified as a duplicate secondary and the active profile demotes it to `off`
- **THEN** the system SHALL exclude that skill from the effective runtime skill set
- **AND** the runtime-facing artifact SHALL record the exclusion reason

### Requirement: Materialize Provider-Specific Runtime Projections
The system SHALL materialize effective runtime skill projections as dedicated artifacts under `.skill-governor/runtime/` without mutating raw provider skill files.

#### Scenario: Write runtime projections after apply
- **WHEN** the user runs `skill-governor apply --plan <plan-id>`
- **THEN** the system SHALL write or refresh provider-specific runtime projection artifacts
- **AND** those artifacts SHALL be grouped under `.skill-governor/runtime/<provider>/`
- **AND** raw provider skill directories SHALL remain unchanged

#### Scenario: Expose machine-readable projection contents
- **WHEN** a runtime projection artifact is generated
- **THEN** it SHALL describe included skills, excluded skills, resolved governance fields, and source paths
- **AND** it SHALL be readable by automation or future provider integrations

### Requirement: Keep Runtime Projections In Sync With Governance State
The system SHALL keep runtime projection artifacts synchronized with the current governance state after apply and rollback flows.

#### Scenario: Refresh projections after successful apply
- **WHEN** a governance plan is applied successfully
- **THEN** the system SHALL refresh runtime projection artifacts as part of the apply workflow
- **AND** the resulting projection SHALL correspond to the newly active profile and state

#### Scenario: Restore consistent projections after rollback
- **WHEN** the user runs `skill-governor rollback`
- **THEN** the system SHALL restore or regenerate runtime projections so they match the restored governance state
- **AND** the system SHALL NOT leave stale runtime projection artifacts in place

### Requirement: Inspect Runtime Projection Results
The system SHALL provide a CLI-visible way to inspect or report provider-specific runtime projection results.

#### Scenario: Inspect effective runtime skills for one provider
- **WHEN** the user requests runtime projection output for a specific provider
- **THEN** the system SHALL return the effective included and excluded skills for that provider
- **AND** the response SHALL include reasons for exclusion where applicable

#### Scenario: Summarize runtime projection coverage in reports
- **WHEN** the user generates a governance report after apply
- **THEN** the report SHALL summarize the effective runtime skill counts by provider
- **AND** distinguish between included and excluded projected skills
