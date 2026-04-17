## Context

The system must govern more than one skill ecosystem at the same time. The initial target includes `cursor`, `codex`, and `claude`, each with user-level and workspace-level skill locations. The governance layer must not mutate raw skill definitions and must support natural-language control through a dedicated `/skill-governor` skill.

The first version is intentionally limited to a governance closed loop:
- discover skills across providers and scopes
- normalize them into a common registry
- analyze duplicates and clusters
- generate governance plans and profile drafts
- apply or roll back governance state written to dedicated config files

This version does not take over provider routing. It produces governance artifacts that can later be consumed by provider runtimes.

## Goals / Non-Goals

### Goals
- Provide a single governance interface for skills from multiple providers.
- Keep all execution inside a deterministic Node.js CLI.
- Support natural-language intent mapping through `/skill-governor`.
- Make all write actions dry-run first, structured, and reversible.
- Separate discovery data, governance state, plans, profiles, and snapshots.

### Non-Goals
- Modifying or rewriting raw `SKILL.md` files.
- Directly changing provider routing behavior in V1.
- Requiring cloud services, embeddings, or LLM-only duplicate detection.
- Synchronizing governance state across machines or accounts.

## Architecture

The system is split into five modules:

1. Provider adapters
Each adapter knows default discovery roots, file layout expectations, and metadata extraction rules for one provider. V1 includes `cursor`, `codex`, and `claude`.

2. Registry builder
This module scans provider roots, locates `SKILL.md`, extracts metadata, and emits normalized `SkillRecord` entries. It persists the latest scan to `registry.json`.

3. Governance engine
This module computes audit summaries, duplicate groups, clusters, optimization recommendations, and draft profiles. It produces `GovernancePlan` objects but does not write final state directly.

4. State store
This module manages `.skill-governor/` artifacts at the user level and workspace level, including `state.json`, `profiles/*.yaml`, `plans/*.json`, `snapshots/*.json`, and reports.

5. CLI facade
This module exposes commands such as `list`, `audit`, `dedupe`, `cluster`, `optimize`, `apply`, `rollback`, `profile use`, and `report`. JSON output is a first-class interface for the `/skill-governor` skill.

Overall flow:

```txt
User
  -> /skill-governor skill
  -> AI orchestrator intent mapping
  -> skill-governor CLI
  -> provider adapters + registry builder
  -> governance engine
  -> state store
```

## Data Model

### SkillRecord

`SkillRecord` is the normalized discovery format. It keeps provider origin and governance state separate so the system can distinguish where a skill was discovered from where governance rules apply.

Key fields:
- `provider`: `cursor | codex | claude | custom`
- `sourceScope`: `user | workspace`
- `path` and `entryFile`
- `name`, `description`, `domain`, `tags`
- `currentMode`: `auto | manual | off`
- `currentPriority`
- `currentGovernanceScope`: `global | workspace | session | task`
- `fingerprints` for duplicate analysis
- `metadata.parseWarnings` and `metadata.inferred`

### Registry

`registry.json` stores the latest normalized scan result:
- schema version
- generation timestamp
- selected providers and sources
- normalized skill list

This acts as a cache and audit surface for read-oriented commands.

### GovernancePlan

`GovernancePlan` is the output of `optimize --dry-run`. It contains:
- plan id
- creation timestamp
- policy (`conservative | balanced | aggressive`)
- summary counts
- ordered `actions[]`
- `profileDrafts[]`
- warnings

Each action captures before/after governance state and machine-readable reasons. `apply` must consume an existing plan instead of recomputing one.

### Profile

Profiles are YAML rule sets stored under `profiles/<name>.yaml`. They use:
- profile metadata
- default governance values
- ordered match rules

Rules are pattern-based instead of enumerating every skill so newly discovered skills can inherit governance behavior automatically.

### State And Snapshot

`state.json` stores the currently active profile, selected providers, selected sources, and the most recently applied plan id.

Each `apply` operation creates a snapshot before mutating state. A snapshot stores:
- previous `state.json`
- previous profile contents
- associated plan id

Rollback restores governance artifacts only; it never touches raw skills.

## Command Semantics

### Read-oriented commands
- `list`: return normalized skills with filters
- `inspect <skill>`: explain one skill and the rule path that produced its effective governance state
- `audit`: summarize totals, distribution, and warnings
- `dedupe --threshold <n>`: report duplicate groups and merge suggestions
- `cluster`: group skills by domain and lightweight semantic heuristics
- `report`: produce Markdown or JSON reports

### Write-oriented commands
- `optimize --policy <name>`: generate a dry-run governance plan
- `apply --plan <id|path>`: persist a specific plan after snapshot creation
- `rollback [snapshotId]`: restore a previous governance snapshot
- `profile use <name>`: activate an existing profile in the chosen state scope

Write-oriented commands obey these rules:
- Preview-first behavior is the default.
- Raw skill files must never be mutated.
- `apply` cannot run without a concrete plan id or plan file.
- All commands support `--format json`.

## Policy Strategy

V1 ships with three optimization policies:

- `conservative`
  - default mode is `manual`
  - only high-confidence core skills become `auto`
  - duplicate skills are down-ranked but not aggressively turned off

- `balanced`
  - stable core and domain skills may become `auto`
  - duplicate secondary skills may be switched to `off`
  - workspace skills receive higher priority than user-level skills

- `aggressive`
  - minimizes automatic routing participation
  - aggressively disables redundant or low-signal skills
  - keeps only a small set of core/domain entry points in `auto`

Optimization proceeds in stages:
1. classify skills into `core`, `domain`, `project`, or `experimental`
2. detect duplicate groups
3. choose a primary skill in each duplicate set using source scope, metadata quality, and existing signal strength
4. assign modes and priorities according to policy
5. derive profile drafts from the action set

## Skill Entry Behavior

The `/skill-governor` skill is the AI-facing interface. It must not access the filesystem directly. It performs:
1. intent parsing
2. command mapping to allowlisted CLI invocations
3. default dry-run execution for mutating requests
4. result summarization from structured JSON
5. explicit confirmation before `apply`

Example mappings:
- "治理一下我的 skill" -> `skill-governor optimize --policy conservative --format json`
- "看看有哪些重复 skill" -> `skill-governor dedupe --threshold 0.8 --format json`
- "列出所有 workspace 的 codex skill" -> `skill-governor list --provider codex --source-scope workspace --format json`
- "切换到 minimal 模式" -> `skill-governor profile use minimal --format json`

## Risks / Trade-offs

- Provider path conventions may evolve.
  - Mitigation: adapters expose defaults plus override support.

- Lightweight duplicate detection can produce false positives.
  - Mitigation: plans include reasons, thresholds are configurable, and apply is separated from optimize.

- Profile rules may be too broad and affect future skills unexpectedly.
  - Mitigation: preserve snapshots, surface affected counts in plans, and keep `inspect` explainability.

- User-level and workspace-level governance can conflict.
  - Mitigation: require explicit source selection and encode selected sources in plan/state outputs.

## Migration Plan

There is no existing implementation to migrate. Initial rollout should:
1. add the spec and CLI contract
2. implement discovery and normalization
3. add governance planning and profile generation
4. add apply, snapshot, and rollback flows
5. author `/skill-governor` skill documentation and examples

## Open Questions

No blocking open questions remain for V1. Runtime provider integration is intentionally deferred to a later change.
