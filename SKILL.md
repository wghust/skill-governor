# Skill: skill-governor

## Description
Use this repository-root skill as the primary interface for governing local skill systems across `codex`, `cursor`, and `claude` providers. The CLI exists as this skill's execution engine.

## Capabilities
- List discovered skills across user and workspace scopes
- Inspect one normalized skill record
- Audit governance health and inventory distribution
- Detect duplicate skills and suggest primary/secondary outcomes
- Cluster skills by domain and useful keywords
- Generate governance plans with `conservative`, `balanced`, or `aggressive` policies
- Apply a stored governance plan through the CLI
- Roll back to the latest or a named snapshot
- Activate an existing governance profile
- Generate Markdown or JSON reports

## Intent Mapping
- "治理一下我的 skill"
  - `skill-governor optimize --policy conservative --format json`
- "看看有哪些重复 skill"
  - `skill-governor dedupe --format json`
- "列出所有 skill"
  - `skill-governor list --format json`
- "列出 workspace 的 codex skill"
  - `skill-governor list --provider codex --source-scope workspace --format json`
- "审计一下当前 skill 状态"
  - `skill-governor audit --format json`
- "切换到 minimal 模式"
  - `skill-governor profile use minimal --scope workspace --format json`
- "应用 plan-123"
  - `skill-governor apply --plan plan-123 --scope workspace --format json`
- "回滚上一次治理"
  - `skill-governor rollback --scope workspace --format json`

## CLI Rules
- Treat this `SKILL.md` as the primary product interface.
- Always call the project CLI as the execution engine, not direct filesystem mutations.
- Prefer `--format json` so the model can interpret stable results.
- Pass `--provider` and `--source-scope` when the user narrows the target set.
- Pass `--scope user|workspace` or `--store-root <path>` for state-changing commands.
- Use `optimize` to generate a plan before `apply`.
- Treat `apply`, `rollback`, and `profile use` as governance state operations against `.skill-governor/`.

## Execution Flow
1. Parse the user request into one governance intent.
2. Map the intent to an allowlisted `skill-governor` CLI command.
3. For mutating requests, run a preview or read step first.
4. Read the CLI JSON output.
5. Summarize the result for the user.
6. If the action persists changes, ask for confirmation before `apply`.

## Safety Rules
- Never edit raw provider `SKILL.md` files directly.
- All write actions must flow through the CLI.
- Default to dry-run behavior for optimization and plan review.
- Require explicit confirmation before `apply`.
- If the user asks to revert, use `rollback` instead of manual file edits.
- If scope is ambiguous, clarify whether governance should target `user` or `workspace`.

## Example Dialogue
User:
`/skill-governor 将我本地的全局 skill 治理一下`

Assistant:
1. Run `skill-governor optimize --policy conservative --format json`
2. Summarize duplicate groups, changed skill count, and profile drafts
3. Ask whether to run `skill-governor apply --plan <plan-id> --scope workspace --format json`

## Output Expectations
- Prefer concise summaries backed by JSON output.
- Mention duplicate groups, changed skill count, active profile, and snapshot id when relevant.
- If a command fails, surface the structured error code and message.
- Keep the user-facing narrative skill-first even when the underlying execution is done by the CLI.
