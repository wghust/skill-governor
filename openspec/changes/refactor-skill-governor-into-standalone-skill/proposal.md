# Change: Refactor skill-governor into a standalone skill package

## Why
The project previously used a provider-scoped packaging model and then a transitional project-local skill layout. That is no longer the target packaging model.

The intended shape is stronger: the repository itself should be the skill package. `skill-governor` should be represented directly as:
- `SKILL.md`
- `cli/`

This means the skill definition lives at the repository root, and the CLI implementation, tests, config, and build scaffolding live under `cli/` so the repository reads as one standalone skill with one execution module.

## What Changes
- Repackage the repository as a standalone `skill-governor` skill.
- Move the primary skill definition to the repository root as `SKILL.md`.
- Consolidate the execution engine and its scaffolding under `cli/`.
- Keep user-facing companion materials such as root examples alongside the root skill entry where they improve discoverability.
- Reframe project structure so the two top-level modules are:
  - `SKILL.md`
  - `cli/`
- Move tests, package metadata, TypeScript config, and CLI source files under `cli/`.
- Update docs and examples so the standalone skill package layout is the primary narrative.

## Impact
- Affected specs: `skill-governance`
- Affected docs: root `SKILL.md`, usage docs, examples, OpenSpec design framing
- Affected code: repository layout, CLI paths, tests, packaging, and references to the old `.codex/skills/skill-governor/` location
- Relationship to existing work:
  - This change supersedes the project-local skill framing from `refactor-skill-governor-around-skill`
  - This change preserves the existing governance behavior, but repackages the repository around the standalone skill boundary
