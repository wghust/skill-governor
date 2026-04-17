## ADDED Requirements

### Requirement: Discover Skills Across Supported Providers
The system SHALL discover skills from supported providers across user-level and workspace-level sources, parse their metadata, and normalize them into a unified registry.

#### Scenario: Discover skills from selected providers and sources
- **WHEN** the user runs a discovery-backed command with `cursor`, `codex`, and `claude` selected
- **AND** user-level and workspace-level sources are enabled
- **THEN** the system SHALL scan the built-in default roots for those providers
- **AND** locate skill entry files such as `SKILL.md`
- **AND** normalize each discovered skill into a shared registry record
- **AND** persist the scan result in a registry artifact for later read-oriented commands

#### Scenario: Support explicit source filtering
- **WHEN** the user limits discovery to `workspace` sources only
- **THEN** the system SHALL ignore user-level discovery roots
- **AND** only include workspace-discovered skills in the resulting registry

### Requirement: Preserve Raw Skill Files As Read-Only Inputs
The system SHALL treat raw provider skill files as read-only inputs and SHALL write governance state only to dedicated governance artifacts.

#### Scenario: Optimize without mutating source skills
- **WHEN** the user runs `skill-governor optimize --policy conservative`
- **THEN** the system SHALL analyze discovered skills and produce a governance plan
- **AND** the system SHALL NOT modify any raw `SKILL.md` file or provider-owned skill directory

#### Scenario: Apply governance state without rewriting raw skill definitions
- **WHEN** the user applies a previously generated governance plan
- **THEN** the system SHALL update dedicated governance state files under `.skill-governor/`
- **AND** the system SHALL leave all raw skill files unchanged

### Requirement: Generate Dry-Run Governance Plans
The system SHALL support preview-first governance planning and SHALL expose plan results in structured JSON.

#### Scenario: Preview an optimization plan
- **WHEN** the user requests optimization for the selected providers and sources
- **THEN** the system SHALL generate a dry-run governance plan
- **AND** the plan SHALL include summary counts, proposed actions, warnings, and profile drafts
- **AND** the plan SHALL be serializable with `--format json`

#### Scenario: Explain proposed changes for one skill
- **WHEN** a generated plan changes a skill's governance mode or priority
- **THEN** the plan SHALL include machine-readable reasons describing why the change was proposed

### Requirement: Apply And Roll Back Governance State
The system SHALL support auditable apply and rollback flows for governance artifacts.

#### Scenario: Apply a plan with snapshot protection
- **WHEN** the user runs `skill-governor apply --plan <plan-id>`
- **THEN** the system SHALL create a governance snapshot before writing any new state
- **AND** the system SHALL persist the selected plan's governance state and profile outputs
- **AND** the system SHALL record the applied plan id in the active state artifact

#### Scenario: Roll back the latest governance change
- **WHEN** the user runs `skill-governor rollback`
- **THEN** the system SHALL restore the most recent snapshot of governance artifacts
- **AND** the system SHALL restore the previous state and profile contents
- **AND** the system SHALL NOT modify raw provider skill files

### Requirement: Support Governance Profiles And Explicit Scope Selection
The system SHALL support reusable governance profiles and explicit governance scope selection for user-level and workspace-level state.

#### Scenario: Activate a named profile for workspace governance
- **WHEN** the user runs `skill-governor profile use minimal`
- **AND** chooses workspace-level governance
- **THEN** the system SHALL activate the `minimal` profile in the workspace governance state
- **AND** record the selected providers and sources associated with that activation

#### Scenario: Represent profile rules as reusable governance logic
- **WHEN** the system writes a governance profile
- **THEN** the profile SHALL support defaults and ordered match rules
- **AND** those rules SHALL be reusable for future skills discovered in the same governance scope

### Requirement: Provide A Natural-Language Governance Entry Skill
The system SHALL provide a `/skill-governor` skill that maps natural-language governance requests to allowlisted CLI commands and summarizes structured results.

#### Scenario: Map a duplicate-audit request to the CLI
- **WHEN** the user asks `/skill-governor 查看重复 skill`
- **THEN** the skill SHALL map the request to the duplicate analysis command
- **AND** execute the CLI in structured output mode
- **AND** summarize the duplicate groups and merge suggestions for the user

#### Scenario: Require confirmation before apply
- **WHEN** the user makes a request that would persist governance changes
- **THEN** the skill SHALL invoke a dry-run or read-only CLI command first
- **AND** summarize the planned changes
- **AND** ask the user for confirmation before running `apply`

### Requirement: Report Governance Health And Structure
The system SHALL provide machine-readable and human-readable reporting for governance state and skill inventory.

#### Scenario: Generate a governance summary report
- **WHEN** the user runs `skill-governor report`
- **THEN** the system SHALL summarize total skill count, provider distribution, source distribution, governance mode distribution, and duplicate group count
- **AND** the report SHALL be available in Markdown and JSON forms

#### Scenario: Audit parsing and discovery warnings
- **WHEN** discovered skills include incomplete or inferred metadata
- **THEN** the audit output SHALL surface parse warnings and inferred-field counts
- **AND** the warnings SHALL remain visible in structured output
