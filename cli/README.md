# skill-governor

This directory contains the CLI execution engine for the standalone `skill-governor` skill package. The primary interface of the repository is the root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md), which accepts natural-language governance requests and maps them to the runtime entrypoint [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor).

The CLI remains part of the project as the development implementation package. It scans user-level and workspace-level skill roots, normalizes discovered `SKILL.md` files, detects overlap, generates governance plans, and persists governance state under `.skill-governor/` without mutating raw provider skill files.

## Primary Interface
Start from the repository-root skill:

- [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md)

The default interaction model is:

1. User asks the `skill-governor` skill for an audit, optimize, apply, rollback, or profile action.
2. The skill maps the request to an allowlisted CLI command.
3. The runtime entrypoint `bin/skill-governor` executes the deterministic governance workflow, built from this package.
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
The CLI package is for maintainers. User-facing runtime usage should prefer `bin/skill-governor`.

## Example Commands
List normalized skills through the execution engine:

```bash
../bin/skill-governor list --format json
```

Audit the current inventory:

```bash
../bin/skill-governor audit --format json
```

Preview a governance plan:

```bash
../bin/skill-governor optimize --policy conservative --scope workspace --format json
```

Apply a stored plan:

```bash
../bin/skill-governor apply --plan plan_conservative_20260417090000 --scope workspace --format json
```

Roll back the latest snapshot:

```bash
../bin/skill-governor rollback --scope workspace --format json
```

Activate a profile:

```bash
../bin/skill-governor profile use conservative --scope workspace --format json
```

## Notes
- The repository-root `SKILL.md` is the primary interface.
- The runtime distribution target is `SKILL.md + bin/skill-governor`.
- All governance writes still go through the CLI execution engine.
- Raw provider `SKILL.md` files remain read-only.
- `apply` and `rollback` are snapshot-based.
