## Context

`skill-governor` is packaged as a standalone skill with:

```txt
skill-governor/
  SKILL.md
  bin/
  cli/
```

The current store path logic still defaults governance artifacts to the selected workspace root. This is inconsistent with the packaging model because the governed project is not the owner of the governance control plane.

The user expectation is that the skill should carry its own state without polluting arbitrary repositories being scanned.

## Goals / Non-Goals

### Goals
- Make the default governance store live under the installed `skill-governor` skill home.
- Preserve the existing logical `user` and `workspace` scopes.
- Prevent collisions between scope-specific artifacts.
- Keep explicit `--store-root` override support.
- Provide a clear migration story for existing workspace-local stores.

### Non-Goals
- Changing the meaning of discovery roots for scanning skills.
- Removing support for scoped governance behavior.
- Rewriting raw provider skill files.
- Changing plan, snapshot, profile, or runtime projection schemas beyond store placement.

## Approaches

### Approach 1: Single shared store under the skill home
Use one default path:

```txt
<skill-home>/.skill-governor/
```

Pros:
- Simplest implementation
- Smallest path change

Cons:
- `user` and `workspace` scope artifacts collide unless filenames or document schemas change
- Harder to reason about rollback boundaries by scope

### Approach 2: Scoped stores under the skill home
Use:

```txt
<skill-home>/.skill-governor/user/
<skill-home>/.skill-governor/workspace/
```

Pros:
- Preserves current scope semantics cleanly
- Avoids artifact collisions
- Keeps migration and rollback behavior easy to reason about

Cons:
- Slightly deeper paths
- Requires store path helpers and commands to resolve one extra segment

### Approach 3: Per-governed-workspace hashed stores under the skill home
Use:

```txt
<skill-home>/.skill-governor/workspaces/<hash>/
```

Pros:
- Strong isolation across many governed workspaces

Cons:
- Adds complexity now
- Harder for users to inspect manually
- Not needed for the current scope-based model

## Recommendation

Use **Approach 2**.

It matches the existing command model best: `user` and `workspace` stay meaningful, but the data belongs to the skill package instead of the scanned repository.

## Decisions

### Decision: Skill home owns the default store
The default governance store root will be resolved relative to the installed `skill-governor` skill home, not the scanned workspace root.

The effective paths become:

```txt
<skill-home>/.skill-governor/user/
<skill-home>/.skill-governor/workspace/
```

### Decision: Scope selects a subdirectory, not the host project
`--scope user|workspace` will continue to choose which governance state is being read or written, but it will no longer change ownership of the storage location.

### Decision: Explicit override remains supported
`--store-root` remains available for automation, tests, and advanced deployments.

### Decision: Legacy workspace-local stores should be detectable
The system should detect legacy stores under governed project roots and provide migration guidance or a safe migration path so existing state is not silently orphaned.

## Migration Plan

1. Add a skill-home resolver for the default installed package root.
2. Change default store path resolution to `<skill-home>/.skill-governor/<scope>/`.
3. Update all commands that currently call `resolveSkillGovernorRoot`.
4. Detect legacy workspace-local `.skill-governor/` stores.
5. Provide migration guidance or optional migration behavior.
6. Update docs and tests to reflect the new default location.

## Risks / Trade-offs

- Risk: existing users may already have valid state under workspace-local `.skill-governor/`.
  - Mitigation: detect legacy stores and surface migration guidance instead of silently ignoring them.

- Risk: resolving the skill home may differ between source-tree development and runtime distribution.
  - Mitigation: define a stable resolver based on the installed skill package layout and cover both source and packaged runtime in tests.

- Risk: users may assume `workspace` scope means “store in the workspace”.
  - Mitigation: clarify in docs that scope is logical governance scope, not the storage owner.
