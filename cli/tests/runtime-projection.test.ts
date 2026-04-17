import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type {
  GovernancePlan,
  ProfileDocument,
  RegistryDocument,
  SkillRecord,
  StateDocument,
} from '../src/types.js'
import { buildRuntimeProjectionSet, refreshRuntimeProjections } from '../src/runtime/resolve.js'
import { writeGovernancePlan } from '../src/store/plans.js'
import { writeProfileDocument } from '../src/store/profiles.js'
import { writeRegistryDocument, writeStateDocument } from '../src/store/state.js'
import { readRuntimeProjectionSet } from '../src/store/runtime.js'

async function createFixture(): Promise<{ baseDir: string; storeRoot: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), 'skill-governor-runtime-'))
  return {
    baseDir,
    storeRoot: join(baseDir, '.skill-governor'),
  }
}

function createSkill(id: string, provider: 'cursor' | 'claude', path: string): SkillRecord {
  return {
    id,
    name: 'skill-governor',
    description: 'Govern local skills',
    provider,
    sourceScope: 'user',
    path,
    entryFile: `${path}/SKILL.md`,
    domain: 'general',
    tags: [],
    currentMode: 'manual',
    currentPriority: 50,
    currentGovernanceScope: 'workspace',
    fingerprints: {
      nameNorm: 'skill-governor',
      descHash: 'hash',
      tokenSet: ['skill-governor'],
    },
    metadata: {
      parseWarnings: [],
      inferred: false,
      discoveredAt: '2026-04-18T00:00:00.000Z',
    },
  }
}

function createProjectionFixture() {
  const cursorSkill = createSkill('cursor-skill', 'cursor', '/skills/cursor/skill-governor')
  const claudeSkill = createSkill('claude-skill', 'claude', '/skills/claude/skill-governor')
  const registry: RegistryDocument = {
    version: 1,
    generatedAt: '2026-04-18T00:00:00.000Z',
    workspaceRoot: '/workspace',
    sources: { user: true, workspace: false },
    providers: ['cursor', 'claude'],
    skills: [cursorSkill, claudeSkill],
  }
  const profile: ProfileDocument = {
    version: 1,
    name: 'conservative',
    description: 'test profile',
    defaults: {
      mode: 'manual',
      priority: 60,
      governanceScope: 'workspace',
    },
    rules: [
      {
        match: { tags: ['duplicate-secondary'] },
        set: { mode: 'off', priority: 30, governanceScope: 'workspace' },
        reason: ['secondary skills from duplicate groups are demoted', 'policy:conservative'],
      },
      {
        match: { tags: ['core'] },
        set: { mode: 'auto', priority: 86, governanceScope: 'workspace' },
        reason: ['classification tier:core', 'policy:conservative'],
      },
    ],
  }
  const plan: GovernancePlan = {
    version: 1,
    id: 'plan-001',
    createdAt: '2026-04-18T00:01:00.000Z',
    policy: 'conservative',
    summary: {
      totalSkills: 2,
      changedSkills: 2,
      duplicateGroups: 1,
      suggestedProfiles: ['conservative'],
    },
    actions: [
      {
        skillId: 'claude-skill',
        provider: 'claude',
        path: '/skills/claude/skill-governor',
        before: { mode: 'manual', priority: 50, governanceScope: 'workspace' },
        after: { mode: 'auto', priority: 90, governanceScope: 'workspace' },
        reason: ['duplicate primary selected', 'policy:conservative', 'tier:core'],
      },
      {
        skillId: 'cursor-skill',
        provider: 'cursor',
        path: '/skills/cursor/skill-governor',
        before: { mode: 'manual', priority: 50, governanceScope: 'workspace' },
        after: { mode: 'off', priority: 30, governanceScope: 'workspace' },
        reason: ['duplicate secondary demoted', 'policy:conservative', 'tier:core'],
      },
    ],
    profileDrafts: [profile],
    warnings: [],
  }
  const state: StateDocument = {
    version: 1,
    activeProfile: 'conservative',
    lastAppliedPlanId: 'plan-001',
    selectedSources: ['user'],
    selectedProviders: ['claude', 'cursor'],
    updatedAt: '2026-04-18T00:02:00.000Z',
  }

  return { registry, profile, plan, state }
}

describe('runtime projections', () => {
  it('resolves included and excluded skills from active governance state', async () => {
    const fixture = await createFixture()
    const { registry, profile, plan, state } = createProjectionFixture()

    try {
      await writeRegistryDocument(fixture.storeRoot, registry)
      await writeProfileDocument(fixture.storeRoot, profile)
      await writeGovernancePlan(fixture.storeRoot, plan)

      const projectionSet = await buildRuntimeProjectionSet({
        storeRoot: fixture.storeRoot,
        registry,
        state,
      })

      const claude = projectionSet.providers.find((projection) => projection.provider === 'claude')
      const cursor = projectionSet.providers.find((projection) => projection.provider === 'cursor')

      expect(claude?.includedSkills[0]?.skillId).toBe('claude-skill')
      expect(claude?.includedSkills[0]?.resolvedMode).toBe('auto')
      expect(cursor?.excludedSkills[0]?.skillId).toBe('cursor-skill')
      expect(cursor?.excludedSkills[0]?.resolvedMode).toBe('off')
      expect(cursor?.excludedSkills[0]?.reasons).toContain('duplicate secondary demoted')
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })

  it('writes projection artifacts to the runtime store', async () => {
    const fixture = await createFixture()
    const { registry, profile, plan, state } = createProjectionFixture()

    try {
      await writeRegistryDocument(fixture.storeRoot, registry)
      await writeProfileDocument(fixture.storeRoot, profile)
      await writeGovernancePlan(fixture.storeRoot, plan)
      await writeStateDocument(fixture.storeRoot, state)

      const written = await refreshRuntimeProjections({ storeRoot: fixture.storeRoot })
      const stored = await readRuntimeProjectionSet(fixture.storeRoot)

      expect(written.providers).toHaveLength(2)
      expect(stored?.activeProfile).toBe('conservative')
      expect(stored?.providers.map((projection) => projection.provider).sort()).toEqual(['claude', 'cursor'])
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })
})
