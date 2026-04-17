# skill-governor

This directory contains the CLI execution engine for the standalone `skill-governor` skill package. The primary interface of the repository is the root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md), which accepts natural-language governance requests and maps them to controlled CLI execution.

The CLI remains part of the project, but as the execution engine behind the skill. It scans user-level and workspace-level skill roots, normalizes discovered `SKILL.md` files, detects overlap, generates governance plans, and persists governance state under `.skill-governor/` without mutating raw provider skill files.

## Primary Interface
Start from the repository-root skill:

- [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md)

The default interaction model is:

1. User asks the `skill-governor` skill for an audit, optimize, apply, rollback, or profile action.
2. The skill maps the request to an allowlisted CLI command.
3. The CLI executes the deterministic governance workflow.
4. The skill summarizes the structured result back to the user.

## Requirements
- Node.js `>=18`
- npm

## Install
```bash
cd cli
npm install
```

## Build
```bash
cd cli
npm run build
```

## Test
```bash
cd cli
npm test
```

## CLI Execution Engine
The CLI is still available for testing and automation, but it is the execution engine behind the skill rather than the primary project surface.

## Example Commands
List normalized skills through the execution engine:

```bash
skill-governor list --format json
```

Audit the current inventory:

```bash
skill-governor audit --format json
```

Preview a governance plan:

```bash
skill-governor optimize --policy conservative --scope workspace --format json
```

Apply a stored plan:

```bash
skill-governor apply --plan plan_conservative_20260417090000 --scope workspace --format json
```

Roll back the latest snapshot:

```bash
skill-governor rollback --scope workspace --format json
```

Activate a profile:

```bash
skill-governor profile use conservative --scope workspace --format json
```

## Notes
- The repository-root `SKILL.md` is the primary interface.
- All governance writes still go through the CLI execution engine.
- Raw provider `SKILL.md` files remain read-only.
- `apply` and `rollback` are snapshot-based.
