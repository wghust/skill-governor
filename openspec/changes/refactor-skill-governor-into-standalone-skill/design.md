## Context

The repository previously used `.codex/skills/skill-governor/SKILL.md` as an intermediate packaging model. That is no longer the target state.

The target state is a standalone skill package where the repository itself is the skill. The top-level boundary should be immediately readable as:

```txt
skill-governor/
  SKILL.md
  cli/
```

The root `SKILL.md` is the product interface. The `cli/` directory contains the execution engine and all of its scaffolding, including source files, package metadata, tests, and examples.
The root may also keep user-facing companion files such as examples and usage notes when that improves discoverability of the standalone skill.

## Goals / Non-Goals

### Goals
- Make the repository itself the `skill-governor` skill package.
- Move the skill definition to root `SKILL.md`.
- Move CLI implementation and scaffolding under `cli/`.
- Make the top-level structure communicate the product boundary without extra explanation.
- Preserve the existing governance behavior and command contracts while changing layout.

### Non-Goals
- Redesigning the governance model itself.
- Replacing the CLI with a different executor.
- Changing the plan, profile, state, or snapshot semantics.
- Introducing multiple top-level skills in the same repository.

## Target Structure

The target structure should be:

```txt
skill-governor/
  SKILL.md
  examples/
  cli/
    package.json
    tsconfig.json
    vitest.config.ts
    README.md
    src/
    tests/
```

Top-level support files such as OpenSpec metadata may remain at the repository root because they describe the repository itself. However, product-facing and execution-facing assets should conform to the standalone skill packaging model.

## Module Boundaries

### Module 1: `SKILL.md`

The root `SKILL.md` owns:
- natural-language intent mapping
- execution flow
- safety rules
- apply confirmation rules
- user-facing examples
- explanation of when and how the CLI is invoked

This file represents the skill itself. It must not be nested under provider-specific directories.

### Module 2: `cli/`

The `cli/` directory owns:
- package metadata
- source code
- tests
- examples
- build and test configuration
- execution entrypoints
- discovery, registry, governance, and state persistence internals

Everything required to build, run, test, and reason about the execution engine should live under `cli/`.

## Migration Plan

The migration should proceed in these steps:

1. Move the skill definition from `.codex/skills/skill-governor/SKILL.md` to root `SKILL.md`.
2. Move CLI runtime files and scaffolding into `cli/`.
3. Update imports, script paths, test paths, and documentation references.
4. Update examples, usage docs, and CLI README to describe the standalone skill package structure.
5. Verify all CLI tests, smoke tests, and OpenSpec validation still pass after relocation.

## Risks / Trade-offs

- Risk: path churn can break imports, tests, and documentation links.
  - Mitigation: treat this as an explicit packaging refactor with end-to-end verification.

- Risk: root-level repository files may still imply a traditional app repo instead of a standalone skill package.
  - Mitigation: keep the product-facing top-level boundary minimal and move execution scaffolding into `cli/`.

- Risk: previous skill locations may remain referenced in docs or tests.
  - Mitigation: explicitly audit and replace stale `.codex/skills/skill-governor/` references and mark them as historical only when retained in change records.

## Open Questions

No blocking design question remains. The required work is primarily repository re-layout and documentation alignment.
