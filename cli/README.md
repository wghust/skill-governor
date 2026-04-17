# `cli`

This directory contains the development implementation of the `skill-governor` execution engine.

The repository-root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md) is the primary interface. It accepts natural-language governance requests and maps them to the runtime entrypoint [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor), which is built from this package.

Use this directory when you need to maintain the runtime, commands, scanning logic, governance engine, or state persistence layer.

## Responsibilities

- Discover skills from `codex`, `cursor`, and `claude`
- Normalize skills across `user` and `workspace` scopes
- Audit, dedupe, cluster, and optimize governance state
- Apply plans and create rollback snapshots
- Persist governance state under `.skill-governor/`
- Keep raw provider `SKILL.md` files read-only

## Interaction model

1. The user asks the root skill for an audit, optimize, apply, rollback, or profile action.
2. The skill maps the request to an allowlisted CLI command.
3. [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor) executes the deterministic workflow implemented here.
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
This package is for maintainers. User-facing runtime usage should prefer [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor).

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
- The repository-root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md) is the primary interface.
- The runtime distribution target is `SKILL.md + bin/skill-governor`.
- All governance writes go through the CLI execution engine.
- Raw provider `SKILL.md` files remain read-only.
- `apply` and `rollback` are snapshot-based.
