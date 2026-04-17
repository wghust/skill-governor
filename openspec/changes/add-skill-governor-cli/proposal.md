# Change: Add skill-governor CLI and governance entry skill

## Why
Local and global AI skills currently participate in routing without unified governance. As the number of installed skills grows, overlapping descriptions, missing scope control, and the lack of an auditable control plane create frequent false positives and make the skill system hard to manage.

The project needs an AI-native governance workflow where natural-language requests are interpreted by a dedicated `/skill-governor` skill, while all actual discovery, planning, apply, and rollback actions are executed by a deterministic Node.js CLI.

## What Changes
- Add a new `skill-governance` capability spec for discovery, governance planning, apply, rollback, profiles, and reporting.
- Add a `/skill-governor` skill definition that maps natural-language governance intents to controlled CLI commands.
- Add a Node.js `skill-governor` CLI implemented in TypeScript and ESM.
- Add provider adapters for `cursor`, `codex`, and `claude` with built-in default discovery roots for user-level and workspace-level skills.
- Add a unified normalized skill registry and governance state store under `.skill-governor/` instead of modifying raw `SKILL.md` files.
- Add dry-run planning, structured JSON output, snapshot-based rollback, and governance profile support.

## Impact
- Affected specs: `skill-governance`
- Affected code: CLI entrypoint, provider adapters, registry builder, governance engine, state store, profile handling, reporting, `/skill-governor` skill package
- Constraints preserved:
  - Raw skill files remain read-only to the governance system
  - All write actions are preview-first and auditable
  - User-level and workspace-level governance are explicitly selectable
  - V1 does not directly change provider runtime routing behavior
