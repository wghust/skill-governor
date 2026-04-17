# Change: Refactor skill-governor around the entry skill

## Why
The current implementation already provides a working governance system, but the project framing is still CLI-first. That does not match the intended product boundary: the project should primarily be a governance skill, with the CLI acting as its deterministic execution engine.

This change re-centers the project around the project-local `skill-governor` `SKILL.md`, so the primary user experience is natural-language governance through the skill while the CLI remains an internal module used for discovery, planning, apply, rollback, and reporting.

## What Changes
- Reframe the project as a skill-first governance system whose primary interface is the project-local `skill-governor` `SKILL.md`.
- Reframe the CLI as the execution engine behind the skill instead of the primary product surface.
- Update the `skill-governance` capability language so the skill is the top-level entrypoint and the CLI is its executor.
- Update design and task framing so the project is described as two top-level modules:
  - `SKILL.md`
  - `cli`
- Preserve the existing CLI implementation and governance artifacts, but treat discovery, registry, governance, and state storage as CLI internals rather than top-level product modules.

## Impact
- Affected specs: `skill-governance`
- Affected docs: project-local `SKILL.md`, README, examples, OpenSpec design framing
- Affected code: no required architectural rewrite of the governance engine; most impact is on system framing, interface hierarchy, and documentation
- Relationship to existing work:
  - This change supersedes the CLI-first framing in `add-skill-governor-cli`
  - This change does not discard the already-implemented CLI capabilities
