## 1. Spec And Design Reframing
- [x] 1.1 Update the `skill-governance` capability language so the entry skill is the primary interface
- [x] 1.2 Reframe the architecture description around two top-level modules: `SKILL.md` and `cli`
- [x] 1.3 Document that this change supersedes the CLI-first framing from `add-skill-governor-cli`

## 2. Documentation Realignment
- [x] 2.1 Update project documentation to introduce the project-local `SKILL.md` before the CLI
- [x] 2.2 Update examples so the skill-first workflow is the default narrative
- [x] 2.3 Keep CLI commands documented as the execution engine and automation surface

## 3. Implementation Consistency Review
- [x] 3.1 Verify the project-local `SKILL.md` remains the primary entrypoint for governance requests
- [x] 3.2 Verify the CLI remains a deterministic executor for discovery, planning, apply, rollback, and reporting
- [x] 3.3 Verify no documentation still describes the CLI as the primary product surface
