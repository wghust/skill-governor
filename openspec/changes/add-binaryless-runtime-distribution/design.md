## Context

The repository is being reshaped into a standalone skill package with root `SKILL.md` and a `cli/` implementation package. That solves the product boundary, but it still leaves the user-facing runtime too heavy if the full development package must be shipped.

The target runtime distribution is:

```txt
skill-governor-runtime/
  SKILL.md
  bin/
    skill-governor
```

The user should not need the source tree, tests, examples, or TypeScript scaffolding in order to use the skill.

## Goals / Non-Goals

### Goals
- Define a minimal runtime distribution for users.
- Use a single-file Node executable script for `bin/skill-governor`.
- Keep the development repository and runtime distribution distinct.
- Ensure `SKILL.md` refers to the runtime `bin/skill-governor` entrypoint.

### Non-Goals
- Shipping a native binary.
- Replacing the existing development `cli/` package.
- Removing source code, tests, or OpenSpec assets from the development repository.
- Changing governance behavior or command semantics.

## Delivery Model

There are now two shapes of the project:

### Development Shape

Used by maintainers:

```txt
skill-governor/
  SKILL.md
  cli/
  openspec/
  docs/
```

### Runtime Distribution Shape

Delivered to users:

```txt
skill-governor-runtime/
  SKILL.md
  bin/
    skill-governor
```

The runtime `bin/skill-governor` is a single-file Node executable script generated from the development CLI package.

## Module Boundaries

### Root `SKILL.md`

Owns:
- user-facing behavior
- intent mapping
- safety rules
- runtime invocation guidance

This file must be usable both in the development repository and in the runtime distribution.

### `cli/`

Owns:
- source code
- tests
- packaging logic
- runtime artifact generation

### `bin/`

Owns:
- generated user-facing runtime executable

The `bin/` directory is part of the runtime distribution surface, not the development architecture surface.

## Runtime Invocation Contract

The skill should invoke:

```txt
bin/skill-governor
```

instead of:
- source file paths
- `npm run` commands
- development-only package-relative commands

This keeps the user-facing execution surface stable and small.

## Migration Plan

1. keep `cli/` as the development implementation package
2. add a packaging step that emits `bin/skill-governor`
3. update `SKILL.md` to reference the runtime entrypoint
4. add tests or checks that the runtime entrypoint exists and is executable in the generated package
5. document the difference between development and user distribution

## Risks / Trade-offs

- Risk: divergence between the generated runtime script and the development CLI behavior
  - Mitigation: generate `bin/skill-governor` from the same source and verify command parity

- Risk: the runtime artifact still implicitly depends on a local Node environment
  - Mitigation: document the Node requirement explicitly and keep the runtime surface minimal

- Risk: docs may mix development commands and runtime commands
  - Mitigation: clearly separate maintainer workflow from end-user runtime usage

## Open Questions

No blocking design question remains. The decision is to ship a single-file Node executable script instead of a native binary.
