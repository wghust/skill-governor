# Change: Add distributable `SKILL.md + bin/skill-governor` packaging

## Why
The current standalone skill packaging still assumes that users receive the full repository or at least the full `cli/` source tree. That increases friction because users may need to install dependencies, understand the source layout, and manage a development-oriented package structure.

The desired distribution model is smaller and easier to consume:
- `SKILL.md`
- `bin/skill-governor`

In this model, the development repository keeps the source code and tests, but the user-facing delivery artifact becomes a minimal runtime package.

## What Changes
- Define a distributable packaging model for `skill-governor` that produces:
  - `SKILL.md`
  - `bin/skill-governor`
- Treat `bin/skill-governor` as a single-file Node executable script, not a native binary.
- Keep `cli/` as the development implementation package.
- Add build or packaging guidance so the development `cli/` package can emit the runtime `bin/skill-governor` artifact.
- Update skill documentation so runtime invocations use `bin/skill-governor` rather than development-oriented source/package paths.

## Impact
- Affected specs: `skill-governance`
- Affected docs: root `SKILL.md`, runtime usage docs, packaging docs
- Affected code: packaging scripts, runtime artifact generation, command invocation references
- Relationship to existing work:
  - This change builds on `refactor-skill-governor-into-standalone-skill`
  - This change does not replace the `cli/` development package; it adds a user-facing distribution layer
