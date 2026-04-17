import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { GovernancePlan, ProfileDocument, StateDocument } from '../src/types.js'

import { applyPlan, rollbackSnapshot } from '../src/apply.js'
import { writeGovernancePlan } from '../src/store/plans.js'
import { readProfileDocument, writeProfileDocument } from '../src/store/profiles.js'
import { readSnapshotDocument } from '../src/store/snapshots.js'
import { readStateDocument, writeStateDocument } from '../src/store/state.js'

async function createFixture(): Promise<{
  baseDir: string
  storeRoot: string
}> {
  const baseDir = await mkdtemp(join(tmpdir(), 'skill-governor-apply-rollback-'))
  return {
    baseDir,
    storeRoot: join(baseDir, '.skill-governor'),
  }
}

function createProfile(name: string, description: string, mode: 'auto' | 'manual' | 'off'): ProfileDocument {
  return {
    version: 1,
    name,
    description,
    defaults: {
      mode,
      priority: mode === 'auto' ? 80 : 50,
      governanceScope: 'workspace',
    },
    rules: [
      {
        match: {
          tags: [name],
        },
        set: {
          mode,
          priority: mode === 'auto' ? 90 : 40,
          governanceScope: 'workspace',
        },
        reason: [`profile:${name}`],
      },
    ],
  }
}

function createPlan(
  id: string,
  profile: ProfileDocument,
  changedSkills: number,
  createdAt: string,
): GovernancePlan {
  return {
    version: 1,
    id,
    createdAt,
    policy: 'balanced',
    summary: {
      totalSkills: 1,
      changedSkills,
      duplicateGroups: 0,
      suggestedProfiles: [profile.name],
    },
    actions: [
      {
        skillId: `${profile.name}-skill`,
        provider: 'codex',
        path: `/skills/${profile.name}/SKILL.md`,
        before: {
          mode: 'manual',
          priority: 50,
          governanceScope: 'workspace',
        },
        after: {
          mode: profile.defaults.mode,
          priority: profile.defaults.priority,
          governanceScope: 'workspace',
        },
        reason: [`profile:${profile.name}`],
      },
    ],
    profileDrafts: [profile],
    warnings: [],
  }
}

describe('apply and rollback orchestration', () => {
  it('requires a stored plan before applying', async () => {
    const fixture = await createFixture()

    try {
      await expect(
        applyPlan({
          storeRoot: fixture.storeRoot,
          planId: 'missing-plan',
        }),
      ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' })
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })

  it('captures a snapshot before applying and writes state and profiles', async () => {
    const fixture = await createFixture()
    const legacyProfile = createProfile('legacy', 'Legacy profile', 'manual')
    const minimalProfile = createProfile('minimal', 'Minimal profile', 'auto')
    const initialState: StateDocument = {
      version: 1,
      activeProfile: 'legacy',
      lastAppliedPlanId: 'plan-legacy',
      selectedSources: ['user'],
      selectedProviders: ['codex'],
      updatedAt: '2026-04-17T00:00:00.000Z',
    }
    const plan = createPlan('plan-001', minimalProfile, 1, '2026-04-17T00:05:00.000Z')

    try {
      await writeProfileDocument(fixture.storeRoot, legacyProfile)
      await writeStateDocument(fixture.storeRoot, initialState)
      await writeGovernancePlan(fixture.storeRoot, plan)

      const result = await applyPlan({
        storeRoot: fixture.storeRoot,
        planId: plan.id,
        snapshotId: 'snapshot-001',
        now: '2026-04-17T00:10:00.000Z',
      })

      expect(result.applied).toBe(true)
      expect(result.snapshot.snapshotId).toBe('snapshot-001')
      expect(result.state.activeProfile).toBe('minimal')
      expect(result.state.lastAppliedPlanId).toBe('plan-001')
      expect(result.writtenProfiles).toEqual(['minimal'])

      const snapshot = await readSnapshotDocument(fixture.storeRoot, 'snapshot-001')
      expect(snapshot).toMatchObject({
        snapshotId: 'snapshot-001',
        basedOnPlanId: 'plan-001',
        previousState: initialState,
        previousProfiles: [legacyProfile],
      })

      expect(await readStateDocument(fixture.storeRoot)).toEqual(result.state)
      expect(await readProfileDocument(fixture.storeRoot, 'minimal')).toEqual(minimalProfile)
      expect(await readProfileDocument(fixture.storeRoot, 'legacy')).toEqual(legacyProfile)
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })

  it('rolls back the latest snapshot and restores prior governance artifacts', async () => {
    const fixture = await createFixture()
    const legacyProfile = createProfile('legacy', 'Legacy profile', 'manual')
    const minimalProfile = createProfile('minimal', 'Minimal profile', 'auto')
    const focusProfile = createProfile('focus', 'Focus profile', 'manual')
    const initialState: StateDocument = {
      version: 1,
      activeProfile: 'legacy',
      lastAppliedPlanId: 'plan-legacy',
      selectedSources: ['workspace'],
      selectedProviders: ['codex'],
      updatedAt: '2026-04-17T00:00:00.000Z',
    }
    const firstPlan = createPlan('plan-001', minimalProfile, 1, '2026-04-17T00:05:00.000Z')
    const secondPlan = createPlan('plan-002', focusProfile, 1, '2026-04-17T00:20:00.000Z')

    try {
      await writeProfileDocument(fixture.storeRoot, legacyProfile)
      await writeStateDocument(fixture.storeRoot, initialState)
      await writeGovernancePlan(fixture.storeRoot, firstPlan)
      await writeGovernancePlan(fixture.storeRoot, secondPlan)

      const firstApply = await applyPlan({
        storeRoot: fixture.storeRoot,
        planId: firstPlan.id,
        snapshotId: 'snapshot-001',
        now: '2026-04-17T00:10:00.000Z',
      })

      expect(firstApply.state.activeProfile).toBe('minimal')

      const secondApply = await applyPlan({
        storeRoot: fixture.storeRoot,
        planId: secondPlan.id,
        snapshotId: 'snapshot-002',
        now: '2026-04-17T00:30:00.000Z',
      })

      expect(secondApply.state.activeProfile).toBe('focus')

      const rollback = await rollbackSnapshot({ storeRoot: fixture.storeRoot })

      expect(rollback.snapshot.snapshotId).toBe('snapshot-002')
      expect(rollback.restoredState).toEqual(firstApply.state)
      expect(rollback.restoredProfiles.sort()).toEqual(['legacy', 'minimal'])
      expect(rollback.removedProfiles).toEqual(['focus'])

      expect(await readStateDocument(fixture.storeRoot)).toEqual(firstApply.state)
      expect(await readProfileDocument(fixture.storeRoot, 'legacy')).toEqual(legacyProfile)
      expect(await readProfileDocument(fixture.storeRoot, 'minimal')).toEqual(minimalProfile)
      expect(await readProfileDocument(fixture.storeRoot, 'focus')).toBeNull()
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })
})
