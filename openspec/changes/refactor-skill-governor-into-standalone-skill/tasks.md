## 1. Standalone Skill Packaging
- [ ] 1.1 Move the skill definition to root `SKILL.md`
- [ ] 1.2 Remove the old `.codex/skills/skill-governor/` packaging assumption from project docs and tests
- [ ] 1.3 Make the repository read as a standalone skill package with `SKILL.md` and `cli/` as the primary boundary

## 2. CLI Relayout
- [ ] 2.1 Move CLI source files under `cli/src/`
- [ ] 2.2 Move CLI tests under `cli/tests/`
- [ ] 2.3 Move CLI examples under `cli/examples/`
- [ ] 2.4 Move package metadata and build/test config under `cli/`

## 3. Reference And Script Updates
- [ ] 3.1 Update build, test, and import paths for the new `cli/` layout
- [ ] 3.2 Update README and examples to describe the standalone skill package
- [ ] 3.3 Update tests and links that reference the old skill path

## 4. Verification
- [ ] 4.1 Verify the root `SKILL.md` remains the primary interface
- [ ] 4.2 Verify the relocated CLI still runs discovery, planning, apply, rollback, and reporting
- [ ] 4.3 Verify repository documentation consistently reflects the standalone skill packaging model
