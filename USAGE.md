# Usage

Use [`skill-governor`](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md) when you need to govern local skill inventories across `codex`, `cursor`, and `claude`.

The primary interface is the repository-root [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md). The execution engine behind it is [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor).

## Use this skill when

- You want to list discovered skills
- You want to inspect one normalized skill
- You want to audit the current governance state
- You want to find duplicate skills
- You want to cluster skills by domain
- You want to generate a governance plan
- You want to apply a reviewed plan
- You want to roll back a previous governance change
- You want to switch governance profiles

## Default workflow

1. Ask for a governance action in natural language.
2. Let the skill map the request to an allowlisted CLI command.
3. Review the JSON-backed summary.
4. If the request changes governance state, confirm before `apply`.

## Example requests

- `治理一下我的 skill`
- `看看有哪些重复 skill`
- `列出所有 skill`
- `列出 workspace 的 codex skill`
- `审计一下当前 skill 状态`
- `切换到 minimal 模式`
- `应用 plan-123`
- `回滚上一次治理`

## What happens internally

The skill maps requests to commands such as:

- `bin/skill-governor list --format json`
- `bin/skill-governor audit --format json`
- `bin/skill-governor dedupe --format json`
- `bin/skill-governor cluster --format json`
- `bin/skill-governor optimize --policy conservative --format json`
- `bin/skill-governor apply --plan <plan-id> --scope workspace --format json`
- `bin/skill-governor rollback --scope workspace --format json`
- `bin/skill-governor profile use <name> --scope workspace --format json`

You should normally think in terms of the skill request, not the raw command.

## Safety rules

- Do not edit raw provider `SKILL.md` files directly.
- All write operations must go through `bin/skill-governor`.
- By default, governance state is written under this skill's own `.skill-governor/user/` or `.skill-governor/workspace/` directories.
- Treat `optimize` as preview-first.
- Run `apply` only after explicit confirmation.
- Use `rollback` for recovery instead of manual file edits.
- Be explicit about `user` vs `workspace` scope when the target is ambiguous.

## Typical flows

### Review current state

1. Ask: `审计一下当前 skill 状态`
2. The skill runs an audit command.
3. You get totals, duplicate counts, warnings, and distribution summaries.

### Generate a governance plan

1. Ask: `治理一下我的 skill`
2. The skill runs `optimize` in JSON mode.
3. You review changed skills, duplicate groups, profile drafts, and warnings.

### Apply a plan

1. Ask to apply a reviewed plan, for example: `应用 plan-123`
2. The skill resolves the correct scope and store target.
3. The CLI snapshots the current governance state first.
4. The new state and profile become active.

### Roll back

1. Ask: `回滚上一次治理`
2. The skill runs rollback.
3. The CLI restores the previous state and profile set from snapshot.

## Related files

- Skill definition: [SKILL.md](/Users/wangbinbin/Documents/workspace/skill-governor/SKILL.md)
- Runtime entrypoint: [bin/skill-governor](/Users/wangbinbin/Documents/workspace/skill-governor/bin/skill-governor)
- CLI implementation: [cli/README.md](/Users/wangbinbin/Documents/workspace/skill-governor/cli/README.md)
- Example plan: [examples/plan.json](/Users/wangbinbin/Documents/workspace/skill-governor/examples/plan.json)
- Example report: [examples/report.md](/Users/wangbinbin/Documents/workspace/skill-governor/examples/report.md)
