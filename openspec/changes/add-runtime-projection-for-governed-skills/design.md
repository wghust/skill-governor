## Context

The project already has a governance control plane:
- discovery and normalization
- duplicate detection and optimize policies
- apply, rollback, and profile activation
- persisted governance state under `.skill-governor/`

What is still missing is a runtime-facing artifact. Providers do not currently consume `.skill-governor/state.json` or `profiles/*.yaml` directly, so governance outcomes do not yet alter the effective skill set seen at runtime.

## Goals / Non-Goals

### Goals
- Derive an effective skill set from governance artifacts.
- Materialize that effective skill set as runtime projection artifacts under `.skill-governor/runtime/`.
- Refresh runtime projections automatically after `apply`.
- Keep provider raw skill files read-only.
- Make the projected runtime view inspectable and reproducible.

### Non-Goals
- Directly rewriting provider-owned skill directories.
- Replacing provider-native routing engines.
- Introducing provider-specific mutation logic for raw skill files.
- Changing the existing governance model for plans, profiles, or snapshots.

## Decisions

### Decision: Use runtime projections instead of direct provider writes
The system will generate projection artifacts under `.skill-governor/runtime/<provider>/` rather than mutating raw provider paths.

This keeps governance state auditable and reversible while creating a runtime-facing bridge that launchers, wrappers, or future provider integrations can consume.

### Decision: Projection is derived from effective governance state
The runtime projection will be derived from:
- discovered registry
- active profile
- current governance state
- duplicate-primary and duplicate-secondary outcomes
- current mode and priority resolution

The projection should represent the effective runtime skill set rather than merely copying plan actions.

### Decision: Apply refreshes projection
`apply` will remain the state-changing boundary. After a plan is applied successfully, the system will regenerate runtime projections so persisted governance state and runtime artifacts stay in sync.

## Runtime Artifact Model

The new store layout should include:

```txt
.skill-governor/
  state.json
  profiles/
  plans/
  snapshots/
  runtime/
    cursor/
    codex/
    claude/
```

Each provider runtime directory should contain a machine-readable projection artifact describing:
- included skills
- excluded skills
- resolved mode
- resolved priority
- source paths
- duplicate-primary or duplicate-secondary status
- generation timestamp

The projection may later expand to symlink or manifest generation, but V1 only requires stable machine-readable artifacts.

## CLI Surface

V1 should support:
- automatic projection refresh during `apply`
- explicit projection generation or refresh command
- explicit projection inspection or report command

This allows operators to understand the runtime-facing result even before providers consume it directly.

## Risks / Trade-offs

- Risk: projected runtime view may diverge from raw registry if regeneration is skipped.
  - Mitigation: refresh projections automatically during `apply`, and expose a manual rebuild path.

- Risk: provider-specific runtime directories may imply full native integration before it exists.
  - Mitigation: document projections as the runtime contract layer, not raw provider mutation.

- Risk: duplicate resolution or profile rules may be misread by downstream consumers.
  - Mitigation: include explicit included/excluded reasons and resolved governance fields in projection artifacts.

## Migration Plan

1. Add runtime projection store paths and schemas.
2. Implement effective runtime resolution from registry + state + profiles.
3. Generate provider-specific runtime artifacts.
4. Extend `apply` to refresh runtime projections automatically.
5. Add CLI inspection/report support for runtime projections.
6. Validate end-to-end behavior after optimize/apply/rollback.
