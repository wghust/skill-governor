## 1. Standalone Skill Packaging
- [x] 1.1 Move the skill definition to root `SKILL.md`
- [x] 1.2 Remove the old `.codex/skills/skill-governor/` packaging assumption from project docs and tests
- [x] 1.3 Make the repository read as a standalone skill package with `SKILL.md` and `cli/` as the primary boundary

## 2. CLI Relayout
- [x] 2.1 Move CLI source files under `cli/src/`
- [x] 2.2 Move CLI tests under `cli/tests/`
- [x] 2.3 Keep end-user examples at the repository root while moving CLI implementation files under `cli/`
- [x] 2.4 Move package metadata and build/test config under `cli/`

## 3. Reference And Script Updates
- [x] 3.1 Update build, test, and import paths for the new `cli/` layout
- [x] 3.2 Update usage docs and examples to describe the standalone skill package
- [x] 3.3 Update tests and links that reference the old skill path

## 4. Verification
- [x] 4.1 Verify the root `SKILL.md` remains the primary interface
- [x] 4.2 Verify the relocated CLI still runs discovery, planning, apply, rollback, and reporting
- [x] 4.3 Verify repository documentation consistently reflects the standalone skill packaging model
