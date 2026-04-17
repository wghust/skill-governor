---
name: skill-governor
description: Govern local skill inventories across `codex`, `cursor`, and `claude`. Use this skill whenever the user wants to list skills, inspect one skill, audit the current inventory, find duplicate skills, cluster skills, generate a governance plan, apply a stored plan, roll back a previous governance change, or switch governance profiles across `user` and `workspace` scopes. Always use this skill instead of manually editing provider `SKILL.md` files.
---

# Skill Governor

Use this skill as the primary interface for skill governance. Execute through `bin/skill-governor`; do not mutate provider files directly.

## What this skill does

- Discover skills from `codex`, `cursor`, and `claude`
- Normalize skills across `user` and `workspace` scopes
- Audit governance health and inventory distribution
- Detect duplicate skills and suggest primary or secondary outcomes
- Cluster skills by domain and useful keywords
- Generate governance plans with `conservative`, `balanced`, or `aggressive` policies
- Apply a stored governance plan
- Roll back to the latest or a named snapshot
- Activate an existing governance profile
- Generate Markdown or JSON reports

## Working rules

- Treat the repository-root `SKILL.md` as the user-facing entrypoint.
- Always call `bin/skill-governor` as the execution engine.
- Prefer `--format json` so results are stable and easy to summarize.
- Pass `--provider` and `--source-scope` when the user narrows the target set.
- Pass `--scope user|workspace` or `--store-root <path>` for state-changing commands.
- Use `optimize` to generate or review a plan before `apply`.
- Keep the user-facing explanation skill-first even when the actual work happens in the CLI.

## Command mapping

Map one user intent to one allowlisted CLI command.

- "治理一下我的 skill"
  - `bin/skill-governor optimize --policy conservative --format json`
- "看看有哪些重复 skill"
  - `bin/skill-governor dedupe --format json`
- "列出所有 skill"
  - `bin/skill-governor list --format json`
- "列出 workspace 的 codex skill"
  - `bin/skill-governor list --provider codex --source-scope workspace --format json`
- "审计一下当前 skill 状态"
  - `bin/skill-governor audit --format json`
- "切换到 minimal 模式"
  - `bin/skill-governor profile use minimal --scope workspace --format json`
- "应用 plan-123"
  - `bin/skill-governor apply --plan plan-123 --scope workspace --format json`
- "回滚上一次治理"
  - `bin/skill-governor rollback --scope workspace --format json`

## Workflow

1. Parse the user request into one governance intent.
2. Decide whether the request is read-only or state-changing.
3. Choose the narrowest useful scope and provider filters.
4. For mutating requests, preview or inspect first whenever possible.
5. Run the mapped `bin/skill-governor` command and read the JSON result.
6. Summarize the outcome in natural language.
7. Before `apply`, require explicit confirmation.

## Safety

- Never edit raw provider `SKILL.md` files directly.
- All write actions must flow through the CLI.
- Treat raw provider skill files as read-only inputs.
- Default to dry-run behavior for optimization and plan review.
- Require explicit confirmation before `apply`.
- Use `rollback` instead of manual file recovery.
- If scope is ambiguous, clarify whether governance should target `user` or `workspace`.

## Example

User:
`/skill-governor 将我本地的全局 skill 治理一下`

Assistant:
1. Run `bin/skill-governor optimize --policy conservative --format json`
2. Summarize duplicate groups, changed skill count, and profile drafts
3. Ask whether to run `bin/skill-governor apply --plan <plan-id> --scope workspace --format json`

## Response guidance

- Prefer concise summaries backed by JSON output.
- Mention duplicate groups, changed skill count, active profile, and snapshot id when relevant.
- If a command fails, surface the structured error code and message.

For extended usage examples and operator guidance, see [USAGE.md](/Users/wangbinbin/Documents/workspace/skill-governor/USAGE.md).
