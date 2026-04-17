# Change: Add runtime projection for governed skills

## Why
The current project provides discovery, governance planning, apply, rollback, and profile state, but those results only live under `.skill-governor/` as control-plane artifacts.

That means the system can explain and persist governance decisions, yet supported providers do not have a runtime-facing artifact to consume. A runtime projection layer is needed so governance state can be transformed into an effective skill set for `cursor`, `codex`, and `claude`.

## What Changes
- Add an effective runtime projection model derived from registry, state, active profile, and governance plan outcomes.
- Add provider-specific runtime projection outputs under `.skill-governor/runtime/`.
- Extend `apply` so it refreshes runtime projections after writing state and profiles.
- Add CLI support to inspect or regenerate runtime projections explicitly.
- Keep raw provider skill files read-only while producing a consumable runtime view.

## Impact
- Affected specs: `skill-governance`
- Affected code: governance resolution, apply workflow, store layout, CLI commands, reporting
- Affected artifacts: `.skill-governor/runtime/cursor/`, `.skill-governor/runtime/codex/`, `.skill-governor/runtime/claude/`
- Relationship to existing work:
  - Builds on `add-skill-governor-cli` governance planning and state persistence
  - Completes the missing runtime bridge after `apply`
