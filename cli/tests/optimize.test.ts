import { describe, expect, it } from 'vitest'
import { createGovernancePlan } from '../src/governance/optimize.js'
import type { RegistryDocument, SkillRecord } from '../src/types.js'

function createSkill(overrides: Partial<SkillRecord>): SkillRecord {
  const base: SkillRecord = {
    id: 'skill-base',
    name: 'Base Skill',
    description: 'Base description',
    provider: 'codex',
    sourceScope: 'user',
    path: '/workspace/skills/base/SKILL.md',
    entryFile: '/workspace/skills/base/SKILL.md',
    domain: 'general',
    tags: [],
    currentMode: 'manual',
    currentPriority: 50,
    currentGovernanceScope: 'workspace',
    fingerprints: {
      nameNorm: 'base skill',
      descHash: 'hash-base',
      tokenSet: ['base', 'skill'],
    },
    metadata: {
      parseWarnings: [],
      inferred: false,
      discoveredAt: '2026-04-17T00:00:00.000Z',
    },
  }

  return {
    ...base,
    ...overrides,
    fingerprints: {
      ...base.fingerprints,
      ...(overrides.fingerprints ?? {}),
    },
    metadata: {
      ...base.metadata,
      ...(overrides.metadata ?? {}),
    },
  }
}

function createRegistry(skills: SkillRecord[]): RegistryDocument {
  return {
    version: 1,
    generatedAt: '2026-04-17T00:00:00.000Z',
    workspaceRoot: '/workspace',
    sources: {
      user: true,
      workspace: true,
    },
    providers: ['cursor', 'codex', 'claude'],
    skills,
  }
}

function findAction(plan: ReturnType<typeof createGovernancePlan>, skillId: string) {
  const action = plan.actions.find((item) => item.skillId === skillId)
  expect(action).toBeDefined()
  return action!
}

describe('createGovernancePlan', () => {
  it('distinguishes policy behavior across conservative and aggressive plans', () => {
    const registry = createRegistry([
      createSkill({
        id: 'workspace-seo',
        name: 'SEO Audit',
        description: 'Audit SEO checks for the workspace',
        provider: 'cursor',
        sourceScope: 'workspace',
        path: '/workspace/.cursor/skills/seo-audit/SKILL.md',
        entryFile: '/workspace/.cursor/skills/seo-audit/SKILL.md',
        domain: 'seo',
        tags: ['seo', 'audit'],
        currentMode: 'manual',
        currentPriority: 40,
        fingerprints: {
          nameNorm: 'seo audit',
          descHash: 'hash-workspace',
          tokenSet: ['seo', 'audit'],
        },
      }),
      createSkill({
        id: 'user-seo',
        name: 'SEO Audit',
        description: 'Audit SEO checks for personal workflows',
        provider: 'codex',
        sourceScope: 'user',
        path: '/users/me/.codex/skills/seo-audit/SKILL.md',
        entryFile: '/users/me/.codex/skills/seo-audit/SKILL.md',
        domain: 'seo',
        tags: ['seo'],
        currentMode: 'manual',
        currentPriority: 90,
        fingerprints: {
          nameNorm: 'seo audit',
          descHash: 'hash-user',
          tokenSet: ['seo', 'audit'],
        },
      }),
      createSkill({
        id: 'workspace-lab',
        name: 'SEO Audit Lab',
        description: 'Prototype audit flow for experimental checks',
        provider: 'claude',
        sourceScope: 'workspace',
        path: '/workspace/.claude/skills/seo-lab/SKILL.md',
        entryFile: '/workspace/.claude/skills/seo-lab/SKILL.md',
        domain: 'seo',
        tags: ['experimental', 'lab'],
        currentMode: 'auto',
        currentPriority: 88,
        fingerprints: {
          nameNorm: 'seo audit lab',
          descHash: 'hash-lab',
          tokenSet: ['seo', 'audit', 'lab'],
        },
        metadata: {
          parseWarnings: ['preview metadata'],
          inferred: true,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
    ])

    const conservative = createGovernancePlan(registry, 'conservative')
    const aggressive = createGovernancePlan(registry, 'aggressive')

    expect(conservative.profileDrafts[0].defaults.mode).toBe('manual')
    expect(aggressive.profileDrafts[0].defaults.mode).toBe('auto')

    const conservativeSecondary = findAction(conservative, 'user-seo')
    const aggressiveSecondary = findAction(aggressive, 'user-seo')

    expect(conservativeSecondary.after.mode).toBe('off')
    expect(aggressiveSecondary.after.mode).toBe('off')
    expect(conservativeSecondary.after.priority).toBeLessThan(aggressiveSecondary.after.priority)

    const conservativePrimary = findAction(conservative, 'workspace-seo')
    const aggressivePrimary = findAction(aggressive, 'workspace-seo')

    expect(conservativePrimary.after.priority).toBeLessThan(aggressivePrimary.after.priority)
    expect(conservative.summary.duplicateGroups).toBe(1)
    expect(aggressive.summary.duplicateGroups).toBe(1)
  })

  it('keeps workspace skills ahead of user skills inside duplicate groups', () => {
    const registry = createRegistry([
      createSkill({
        id: 'workspace-core',
        name: 'Governance Core',
        description: 'Shared governance entrypoint',
        provider: 'cursor',
        sourceScope: 'workspace',
        path: '/workspace/.cursor/skills/governance-core/SKILL.md',
        entryFile: '/workspace/.cursor/skills/governance-core/SKILL.md',
        domain: 'governance',
        tags: ['core'],
        currentMode: 'manual',
        currentPriority: 55,
        fingerprints: {
          nameNorm: 'governance core',
          descHash: 'hash-core-ws',
          tokenSet: ['governance', 'core'],
        },
      }),
      createSkill({
        id: 'user-core',
        name: 'Governance Core',
        description: 'Shared governance entrypoint',
        provider: 'codex',
        sourceScope: 'user',
        path: '/users/me/.codex/skills/governance-core/SKILL.md',
        entryFile: '/users/me/.codex/skills/governance-core/SKILL.md',
        domain: 'governance',
        tags: ['core'],
        currentMode: 'manual',
        currentPriority: 95,
        fingerprints: {
          nameNorm: 'governance core',
          descHash: 'hash-core-user',
          tokenSet: ['governance', 'core'],
        },
      }),
    ])

    const plan = createGovernancePlan(registry, 'balanced')
    const workspaceAction = findAction(plan, 'workspace-core')
    const userAction = findAction(plan, 'user-core')

    expect(plan.summary.duplicateGroups).toBe(1)
    expect(workspaceAction.before.priority).toBe(55)
    expect(userAction.before.priority).toBe(95)
    expect(workspaceAction.after.priority).toBeGreaterThan(userAction.after.priority)
    expect(workspaceAction.reason.join(' ')).toContain('duplicate primary selected')
    expect(userAction.reason.join(' ')).toContain('duplicate secondary demoted')
  })

  it('demotes duplicate secondary skills and emits profile drafts with tier rules', () => {
    const registry = createRegistry([
      createSkill({
        id: 'workspace-project',
        name: 'Project Workflow',
        description: 'Project specific helper',
        provider: 'cursor',
        sourceScope: 'workspace',
        path: '/workspace/.cursor/skills/project-workflow/SKILL.md',
        entryFile: '/workspace/.cursor/skills/project-workflow/SKILL.md',
        domain: 'workflow',
        tags: ['project'],
        projects: ['portal'],
        currentMode: 'auto',
        currentPriority: 72,
        fingerprints: {
          nameNorm: 'project workflow',
          descHash: 'hash-project-ws',
          tokenSet: ['project', 'workflow'],
        },
      }),
      createSkill({
        id: 'user-project',
        name: 'Project Workflow',
        description: 'Project specific helper',
        provider: 'claude',
        sourceScope: 'user',
        path: '/users/me/.claude/skills/project-workflow/SKILL.md',
        entryFile: '/users/me/.claude/skills/project-workflow/SKILL.md',
        domain: 'workflow',
        tags: ['project'],
        projects: ['portal'],
        currentMode: 'auto',
        currentPriority: 88,
        fingerprints: {
          nameNorm: 'project workflow',
          descHash: 'hash-project-user',
          tokenSet: ['project', 'workflow'],
        },
      }),
      createSkill({
        id: 'workspace-experimental',
        name: 'Workflow Lab',
        description: 'Experimental workflow prototype',
        provider: 'codex',
        sourceScope: 'workspace',
        path: '/workspace/.codex/skills/workflow-lab/SKILL.md',
        entryFile: '/workspace/.codex/skills/workflow-lab/SKILL.md',
        domain: 'workflow',
        tags: ['experimental', 'lab'],
        currentMode: 'auto',
        currentPriority: 83,
        fingerprints: {
          nameNorm: 'workflow lab',
          descHash: 'hash-experimental',
          tokenSet: ['workflow', 'lab'],
        },
      }),
    ])

    const plan = createGovernancePlan(registry, 'conservative')
    const userAction = findAction(plan, 'user-project')
    const profile = plan.profileDrafts[0]

    expect(userAction.before.mode).toBe('auto')
    expect(userAction.after.mode).toBe('off')
    expect(userAction.after.priority).toBeLessThan(userAction.before.priority)
    expect(plan.actions[0].skillId).toBe('user-project')
    expect(profile.name).toBe('conservative')
    expect(profile.rules.some((rule) => rule.match.tags?.includes('experimental'))).toBe(true)
    expect(profile.rules.some((rule) => rule.match.tags?.includes('duplicate-secondary'))).toBe(true)
    expect(profile.rules.some((rule) => rule.match.sourceScope?.includes('workspace'))).toBe(true)
  })
})
