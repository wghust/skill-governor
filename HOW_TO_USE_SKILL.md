# How To Use `skill-governor`

## Purpose
`skill-governor` is a standalone skill for governing local AI skills across `codex`, `cursor`, and `claude`.

The primary interface is the root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md).
You should interact with this project as a skill first. The runtime entrypoint is [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor), generated from the development package under [cli](/Users/wangbinbin/Documents/workspace/skill-governor/cli).

## When To Use It
Use `skill-governor` when you want to:

- list all available skills
- inspect one skill
- audit current skill coverage and health
- find duplicate skills
- cluster skills by domain
- generate a governance plan
- apply a stored governance plan
- roll back a previous governance change
- activate an existing profile

## Default Interaction Model
The expected flow is:

1. Ask for a governance action in natural language.
2. Let the skill map that request to a controlled CLI command.
3. Review the summary result.
4. If the request changes governance state, confirm before `apply`.

## Example Requests
You can ask for things like:

- `治理一下我的 skill`
- `看看有哪些重复 skill`
- `列出所有 skill`
- `列出 workspace 的 codex skill`
- `审计一下当前 skill 状态`
- `切换到 minimal 模式`
- `应用 plan-123`
- `回滚上一次治理`

## What The Skill Does Internally
The skill maps those requests to CLI commands such as:

- `bin/skill-governor list --format json`
- `bin/skill-governor audit --format json`
- `bin/skill-governor dedupe --format json`
- `bin/skill-governor cluster --format json`
- `bin/skill-governor optimize --policy conservative --format json`
- `bin/skill-governor apply --plan <plan-id> --scope workspace --format json`
- `bin/skill-governor rollback --scope workspace --format json`
- `bin/skill-governor profile use <name> --scope workspace --format json`

As a user, you normally do not need to think in terms of CLI commands first. The skill is supposed to handle that mapping.

## Recommended Usage Patterns

### 1. Audit Before Changing Anything
Start with a read-only request:

- `审计一下当前 skill 状态`
- `看看有哪些重复 skill`

This helps you understand the current state before generating or applying changes.

### 2. Generate A Plan Before Apply
For governance changes, prefer:

1. `治理一下我的 skill`
2. review the generated plan summary
3. confirm whether to run `apply`

Do not jump directly to `apply` unless you already have a reviewed plan id.

### 3. Be Explicit About Scope
If the target is unclear, specify whether you mean:

- `user`
- `workspace`

Examples:

- `列出 workspace 的 codex skill`
- `应用 plan-123 到 workspace`
- `回滚 user 级别上一次治理`

## Safety Rules
- Do not edit raw provider `SKILL.md` files directly.
- All write operations must go through the CLI execution engine.
- `optimize` should be treated as preview-first.
- `apply` should only happen after explicit confirmation.
- `rollback` should be used for recovery instead of manual file edits.

## Typical End-To-End Flow

### Flow A: Review Current State
1. Ask: `审计一下当前 skill 状态`
2. The skill runs an audit command.
3. You get a summary of totals, duplicates, warnings, and distribution.

### Flow B: Generate A Governance Plan
1. Ask: `治理一下我的 skill`
2. The skill runs `optimize` in JSON mode.
3. You review changed skills, duplicate groups, profile drafts, and warnings.

### Flow C: Apply A Plan
1. Ask to apply a reviewed plan, for example: `应用 plan-123`
2. The skill resolves the correct scope and store target.
3. The CLI snapshots the current governance state first.
4. The plan is applied and the new state/profile becomes active.

### Flow D: Roll Back
1. Ask: `回滚上一次治理`
2. The skill runs rollback.
3. The CLI restores the previous state and profile set from snapshot.

## Where To Look Next
- Skill definition: [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md)
- Runtime entrypoint: [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor)
- CLI execution engine: [cli/README.md](/Users/wangbinbin/Documents/workspace/skill-governor/cli/README.md)
- Example plan: [cli/examples/plan.json](/Users/wangbinbin/Documents/workspace/skill-governor/cli/examples/plan.json)
- Example report: [cli/examples/report.md](/Users/wangbinbin/Documents/workspace/skill-governor/cli/examples/report.md)
