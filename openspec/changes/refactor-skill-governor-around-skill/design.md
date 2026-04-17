## Context

The current project already implements a working `skill-governor` CLI, project-local `SKILL.md`, provider discovery, governance analysis, planning, and state persistence. However, the system is currently described as if the CLI were the primary product and the skill were only an entry wrapper.

That framing is backwards for the intended product boundary. The project is meant to be a governance skill first. The CLI exists to execute the skill's decisions in a deterministic, auditable way.

This change does not require replacing the existing implementation. It changes the architectural framing, capability language, and user-facing contract so the skill becomes the system's primary interface and the CLI becomes a subordinate execution layer.

## Goals / Non-Goals

### Goals
- Make the project-local `skill-governor` `SKILL.md` the primary interface of the system.
- Treat the CLI as the execution engine behind the skill.
- Update OpenSpec and project documentation to consistently use skill-first language.
- Preserve the existing governance behavior and persistence model.
- Reduce the top-level architecture description to two explicit modules:
  - `SKILL.md`
  - `cli`

### Non-Goals
- Rewriting the governance engine, discovery logic, or persistence model.
- Removing the CLI or making it inaccessible for testing and automation.
- Replacing the current plan, snapshot, or profile formats.
- Adding new governance behavior beyond the interface and framing shift.

## Primary Interface

The primary user-facing interface SHALL be the project-local `skill-governor` `SKILL.md`.

The entry skill is responsible for:
- understanding natural-language governance requests
- choosing the correct CLI command
- applying safety rules such as preview-first and explicit apply confirmation
- interpreting structured CLI output
- returning concise governance summaries to the user

The CLI is not removed. It remains the deterministic execution surface. However, it is no longer the top-level product identity of the project.

## Architecture

The system should be described from the outside in:

```txt
User
  -> skill-governor (SKILL.md)
  -> intent mapping + safety policy + response shaping
  -> skill-governor CLI
  -> CLI internals (discovery, registry, governance, state store)
```

This framing makes two boundaries explicit:

1. `SKILL.md` is the product interface.
2. `cli` is the execution module.

Everything else is an internal concern of the CLI.

## Module Boundaries

### Module 1: `SKILL.md`

This module owns:
- natural-language intent mapping
- execution flow
- dry-run-first behavior
- apply confirmation rules
- user-facing examples
- result interpretation

This is the primary interface that users should conceptually interact with.

### Module 2: `cli`

This module owns:
- provider discovery
- skill normalization
- registry generation
- audit, dedupe, cluster, optimize logic
- plan, profile, state, and snapshot persistence
- apply / rollback / profile activation orchestration
- report generation

Internally, the CLI may keep its current submodules such as providers, registry, governance, and store. These remain valid implementation details. They are simply no longer described as peer modules of the product.

## Documentation Implications

The documentation hierarchy should shift in these ways:
- present the project-local `SKILL.md` as the primary entrypoint
- present the CLI as the skill's execution layer
- explain governance actions through the skill-first flow:
  - user intent
  - skill mapping
  - CLI execution
  - summarized result

README and examples should still include CLI commands for testing and automation, but they should describe those commands as the execution engine behind the skill.

## Migration Plan

This is a framing and specification migration, not a storage or runtime migration.

Steps:
1. add a new OpenSpec change that supersedes the CLI-first project framing
2. update the `skill-governance` capability requirements
3. update docs and examples so the skill is always introduced first
4. keep the implemented CLI and persistence behavior intact

## Risks / Trade-offs

- Risk: documentation and implementation drift if the skill-first framing is updated in spec but not reflected in project docs
  - Mitigation: update OpenSpec, project-local `SKILL.md`, README, and examples together

- Risk: confusion about whether the CLI is still supported directly
  - Mitigation: explicitly describe the CLI as a supported execution engine and automation surface

- Risk: the previous CLI-first change remains in history and causes ambiguity
  - Mitigation: mark this change as superseding the framing of `add-skill-governor-cli`

## Open Questions

No blocking technical questions remain. The remaining work is to standardize the system framing and primary interface language.
