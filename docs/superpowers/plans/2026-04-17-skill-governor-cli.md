# Skill Governor CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working version of the `skill-governor` Node.js CLI and `/skill-governor` entry skill for multi-provider skill discovery, governance planning, profile/state persistence, and rollback-safe apply flows.

**Architecture:** Implement a TypeScript ESM CLI with clear boundaries: provider adapters discover raw skills, a registry builder normalizes them, a governance engine derives audit/dedupe/cluster/optimize results, and a state store persists plans, profiles, snapshots, and active state under `.skill-governor/`. Keep raw `SKILL.md` files read-only and make all mutating actions plan-first.

**Tech Stack:** Node.js 18+, TypeScript, commander, yaml, fs/promises, vitest

---

### Task 1: Bootstrap the CLI workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Create: `src/index.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write the failing bootstrap test**

```ts
import { describe, expect, it } from 'vitest'
import { buildCli } from '../src/cli'

describe('buildCli', () => {
  it('registers the root command', () => {
    const program = buildCli()
    expect(program.name()).toBe('skill-governor')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`
Expected: FAIL because `src/cli.ts` and the test runner do not exist yet.

- [ ] **Step 3: Write the minimal CLI scaffold**

```ts
import { Command } from 'commander'

export function buildCli(): Command {
  return new Command().name('skill-governor')
}
```

- [ ] **Step 4: Add package metadata and test runner**

Create `package.json` scripts:

```json
{
  "type": "module",
  "bin": {
    "skill-governor": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Run tests and build**

Run: `npm test`
Expected: PASS for the bootstrap test.

Run: `npm run build`
Expected: PASS and emit `dist/`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore vitest.config.ts src/cli.ts src/index.ts
git commit -m "feat: bootstrap skill governor cli"
```

### Task 2: Define shared domain types and JSON contracts

**Files:**
- Create: `src/types.ts`
- Create: `src/contracts.ts`
- Create: `tests/contracts.test.ts`

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyRegistry } from '../src/contracts'

describe('contracts', () => {
  it('creates a versioned registry envelope', () => {
    const registry = createEmptyRegistry('/tmp/workspace')
    expect(registry.version).toBe(1)
    expect(registry.workspaceRoot).toBe('/tmp/workspace')
    expect(registry.skills).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/contracts.test.ts`
Expected: FAIL because the contracts module does not exist.

- [ ] **Step 3: Implement shared types**

Define:
- `Provider`
- `SourceScope`
- `GovernanceMode`
- `GovernanceScope`
- `SkillRecord`
- `RegistryDocument`
- `GovernancePlan`
- `SkillAction`
- `ProfileDocument`
- `StateDocument`
- `SnapshotDocument`
- `CliSuccess<T>`
- `CliError`

- [ ] **Step 4: Implement envelope helpers**

Add helpers such as:

```ts
export function createEmptyRegistry(workspaceRoot: string): RegistryDocument
export function success<T>(data: T): CliSuccess<T>
export function failure(code: string, message: string, details?: unknown): CliError
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/contracts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/contracts.ts tests/contracts.test.ts
git commit -m "feat: define governance domain contracts"
```

### Task 3: Implement provider adapter discovery

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/cursor.ts`
- Create: `src/providers/codex.ts`
- Create: `src/providers/claude.ts`
- Create: `src/providers/index.ts`
- Create: `tests/providers.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Cover:
- default user roots per provider
- default workspace roots per provider
- deterministic provider ids

Example assertion:

```ts
expect(getProviderAdapter('codex').provider).toBe('codex')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/providers.test.ts`
Expected: FAIL because provider modules do not exist.

- [ ] **Step 3: Implement adapter interface**

Include:
- `provider`
- `getDefaultUserRoots(homeDir: string): string[]`
- `getDefaultWorkspaceRoots(workspaceRoot: string): string[]`
- `findSkillEntryCandidates(root: string): Promise<string[]>`
- `parseSkill(entryFile: string): Promise<Partial<SkillRecord>>`

- [ ] **Step 4: Implement built-in adapters**

Use conventional defaults and keep them overrideable. Parse `SKILL.md` as read-only text and infer:
- name
- description
- tags
- domain

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/providers.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/providers tests/providers.test.ts
git commit -m "feat: add built-in provider adapters"
```

### Task 4: Build registry scanning and normalization

**Files:**
- Create: `src/registry/scan.ts`
- Create: `src/registry/normalize.ts`
- Create: `src/registry/index.ts`
- Create: `tests/registry.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing registry tests**

Test fixtures should simulate:
- user-level skill roots
- workspace-level skill roots
- missing metadata

Assert:
- registry includes both source scopes
- inferred fields are marked
- parse warnings are preserved

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/registry.test.ts`
Expected: FAIL because registry modules do not exist.

- [ ] **Step 3: Implement the scanner**

Responsibilities:
- select enabled providers
- select enabled source scopes
- enumerate adapter roots
- collect `SKILL.md` candidates

- [ ] **Step 4: Implement normalization**

Normalize to complete `SkillRecord` values:
- stable `id`
- `fingerprints`
- fallback `currentMode = 'manual'`
- fallback `currentPriority = 50`
- fallback `currentGovernanceScope = 'workspace'`

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/registry.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/registry src/types.ts tests/registry.test.ts
git commit -m "feat: build normalized skill registry"
```

### Task 5: Persist governance artifacts

**Files:**
- Create: `src/store/paths.ts`
- Create: `src/store/files.ts`
- Create: `src/store/state.ts`
- Create: `src/store/plans.ts`
- Create: `src/store/snapshots.ts`
- Create: `src/store/profiles.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Cover:
- user-level vs workspace-level `.skill-governor` paths
- atomic write/read of `registry.json`, `state.json`, `plans/*.json`
- snapshot capture before apply

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/store.test.ts`
Expected: FAIL because store modules do not exist.

- [ ] **Step 3: Implement store path helpers**

Define helpers for:
- user-level base dir
- workspace base dir
- profile dir
- plan dir
- snapshot dir

- [ ] **Step 4: Implement JSON/YAML persistence**

Support:
- read missing file as `null`
- write directory-on-demand
- stable file naming for plans and snapshots

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store tests/store.test.ts
git commit -m "feat: persist governance state artifacts"
```

### Task 6: Implement audit, dedupe, and cluster analysis

**Files:**
- Create: `src/governance/audit.ts`
- Create: `src/governance/dedupe.ts`
- Create: `src/governance/cluster.ts`
- Create: `tests/governance-analysis.test.ts`

- [ ] **Step 1: Write failing analysis tests**

Create fixtures for:
- duplicate names
- overlapping descriptions
- domain keyword grouping

Assert:
- audit counts by provider, source scope, and mode
- duplicate groups contain primary and secondary candidates
- cluster output groups by domain

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/governance-analysis.test.ts`
Expected: FAIL because analysis modules do not exist.

- [ ] **Step 3: Implement audit summary**

Output:
- total skills
- by provider
- by source scope
- by mode
- inferred count
- warning count

- [ ] **Step 4: Implement duplicate detection and clustering**

Start with deterministic heuristics:
- normalized name equality
- token overlap threshold
- tag/domain overlap

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/governance-analysis.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/governance tests/governance-analysis.test.ts
git commit -m "feat: add governance analysis commands"
```

### Task 7: Implement optimization planning

**Files:**
- Create: `src/governance/policies.ts`
- Create: `src/governance/optimize.ts`
- Create: `tests/optimize.test.ts`
- Modify: `src/contracts.ts`

- [ ] **Step 1: Write failing optimization tests**

Cover:
- `conservative`, `balanced`, `aggressive`
- workspace skill priority over user skill
- duplicate secondary skill demotion
- profile draft generation

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/optimize.test.ts`
Expected: FAIL because optimize modules do not exist.

- [ ] **Step 3: Implement policy helpers**

Encode:
- classification tiers
- primary-skill selection
- mode assignment
- priority assignment

- [ ] **Step 4: Implement `createGovernancePlan`**

Plan output must include:
- plan id
- summary
- ordered actions
- profile drafts
- warnings

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/optimize.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/governance src/contracts.ts tests/optimize.test.ts
git commit -m "feat: add optimization planning engine"
```

### Task 8: Wire CLI commands and JSON output

**Files:**
- Modify: `src/cli.ts`
- Create: `src/commands/list.ts`
- Create: `src/commands/inspect.ts`
- Create: `src/commands/audit.ts`
- Create: `src/commands/dedupe.ts`
- Create: `src/commands/cluster.ts`
- Create: `src/commands/optimize.ts`
- Create: `src/commands/apply.ts`
- Create: `src/commands/rollback.ts`
- Create: `src/commands/profile-use.ts`
- Create: `src/commands/report.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI integration tests**

Cover:
- `list --format json`
- `audit --format json`
- `optimize --policy conservative --format json`
- `apply --plan ...`
- `rollback`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/cli.test.ts`
Expected: FAIL because the commands are not registered yet.

- [ ] **Step 3: Implement read-only command handlers**

Wire `list`, `inspect`, `audit`, `dedupe`, `cluster`, `report` first.

- [ ] **Step 4: Implement mutating command handlers**

Wire `optimize`, `apply`, `rollback`, `profile use` with:
- JSON envelopes
- structured errors
- explicit plan lookup for `apply`

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/cli.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands src/cli.ts tests/cli.test.ts
git commit -m "feat: wire governance cli commands"
```

### Task 9: Add apply and rollback orchestration

**Files:**
- Create: `src/apply.ts`
- Create: `tests/apply-rollback.test.ts`
- Modify: `src/store/state.ts`
- Modify: `src/store/plans.ts`
- Modify: `src/store/snapshots.ts`

- [ ] **Step 1: Write failing apply/rollback tests**

Cover:
- apply requires a plan
- apply writes snapshot first
- apply updates state and profiles
- rollback restores previous state and profile contents

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/apply-rollback.test.ts`
Expected: FAIL because orchestration does not exist.

- [ ] **Step 3: Implement orchestration**

Add:
- `applyPlan()`
- `rollbackSnapshot()`

Guarantees:
- snapshot first
- no mutation of raw skill files
- deterministic state transitions

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/apply-rollback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/apply.ts src/store tests/apply-rollback.test.ts
git commit -m "feat: add apply and rollback orchestration"
```

### Task 10: Author the `/skill-governor` skill and examples

**Files:**
- Create: `.codex/skills/skill-governor/SKILL.md`
- Create: `examples/report.md`
- Create: `examples/plan.json`
- Create: `tests/skill-doc.test.ts`

- [ ] **Step 1: Write the failing documentation test**

Assert that `SKILL.md` contains:
- description
- capability list
- intent mapping examples
- CLI safety rules
- dry-run and apply confirmation rules

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/skill-doc.test.ts`
Expected: FAIL because the skill entry does not exist.

- [ ] **Step 3: Write the skill entry**

Document:
- natural-language to CLI mapping
- dry-run-first behavior
- JSON output expectation
- apply confirmation requirement

- [ ] **Step 4: Add examples**

Include:
- sample CLI JSON output
- sample Markdown report

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/skill-doc.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .codex/skills/skill-governor/SKILL.md examples tests/skill-doc.test.ts
git commit -m "feat: add skill governor entry skill"
```

### Task 11: End-to-end verification and spec/task sync

**Files:**
- Modify: `openspec/changes/add-skill-governor-cli/tasks.md`
- Modify: `README.md`
- Create: `tests/e2e-smoke.test.ts`

- [ ] **Step 1: Write a failing smoke test**

Exercise:
- fixture discovery
- `optimize --format json`
- `apply --plan`
- `report --format json`

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `npm test -- tests/e2e-smoke.test.ts`
Expected: FAIL until the full workflow is connected.

- [ ] **Step 3: Implement missing glue and docs**

Add minimal `README.md` with:
- install
- build
- test
- example commands

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

Run: `openspec validate add-skill-governor-cli --strict`
Expected: PASS.

- [ ] **Step 5: Mark completed tasks in OpenSpec**

Update `openspec/changes/add-skill-governor-cli/tasks.md` checkboxes to reflect actual completion.

- [ ] **Step 6: Commit**

```bash
git add openspec/changes/add-skill-governor-cli/tasks.md README.md tests/e2e-smoke.test.ts
git commit -m "feat: finalize skill governor v1 workflow"
```
