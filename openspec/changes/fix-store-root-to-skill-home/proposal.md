# Change: Fix governance store root to the skill home

## Why
The current implementation writes `.skill-governor/` under the selected workspace root by default. That pollutes the user's own project directory and breaks the packaging goal of `skill-governor` as a standalone skill.

The governance store should belong to the `skill-governor` skill itself, not to whichever project happens to be scanned or governed.

## What Changes
- Change the default governance store location from the scanned workspace root to the installed `skill-governor` skill home.
- Keep `user` and `workspace` as logical governance scopes, but materialize them under the skill-owned store.
- Introduce scoped subdirectories so user-scope and workspace-scope artifacts do not collide.
- Preserve `--store-root` as an explicit override for advanced usage.
- Add legacy store detection and migration guidance for previously created workspace-local `.skill-governor/` directories.

## Impact
- Affected specs: `skill-governance`
- Affected code: store path resolution, CLI command defaults, apply/rollback/profile/projection/report flows, docs
- Affected artifacts:
  - from: `<workspace>/.skill-governor/`
  - to: `<skill-home>/.skill-governor/user/` and `<skill-home>/.skill-governor/workspace/`
