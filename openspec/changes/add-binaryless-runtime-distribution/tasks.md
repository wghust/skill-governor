## 1. Packaging Model
- [x] 1.1 Define the minimal runtime distribution as `SKILL.md + bin/skill-governor`
- [x] 1.2 Keep `cli/` as the development implementation package
- [x] 1.3 Document the difference between development layout and user runtime layout

## 2. Runtime Artifact
- [x] 2.1 Add a packaging path that emits `bin/skill-governor`
- [x] 2.2 Ensure the runtime entrypoint is a single-file Node executable script
- [x] 2.3 Ensure `SKILL.md` references the runtime entrypoint instead of development-only commands

## 3. Verification
- [x] 3.1 Verify the runtime artifact preserves CLI behavior
- [x] 3.2 Verify user-facing docs no longer require the source tree for basic usage
- [x] 3.3 Verify maintainer docs still describe how to build and test the development CLI
