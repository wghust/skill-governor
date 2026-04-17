import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type {
  GovernancePlan,
  ProfileDocument,
  RegistryDocument,
  SnapshotDocument,
  StateDocument,
} from '../src/types.js'

import {
  resolvePlanFilePath,
  resolveProfileFilePath,
  resolveRegistryFilePath,
  resolveScopedSkillGovernorRoot,
  resolveSnapshotFilePath,
  resolveStateFilePath,
} from '../src/store/paths.js'
import { readJsonFile } from '../src/store/files.js'
import {
  readRegistryDocument,
  readStateDocument,
  writeRegistryDocument,
  writeStateDocument,
} from '../src/store/state.js'
import { readGovernancePlan, writeGovernancePlan } from '../src/store/plans.js'
import {
  captureSnapshot,
  readSnapshotDocument,
} from '../src/store/snapshots.js'
import {
  readProfileDocument,
  writeProfileDocument,
} from '../src/store/profiles.js'

async function createStoreFixture(): Promise<{
  baseDir: string
  homeDir: string
  workspaceRoot: string
  userRoot: string
  workspaceStoreRoot: string
}> {
  const baseDir = await mkdtemp(join(tmpdir(), 'skill-governor-store-'))
  const homeDir = join(baseDir, 'home')
  const workspaceRoot = join(baseDir, 'workspace')
  const userRoot = resolveScopedSkillGovernorRoot(baseDir, 'user')
  const workspaceStoreRoot = resolveScopedSkillGovernorRoot(baseDir, 'workspace')

  return {
    baseDir,
    homeDir,
    workspaceRoot,
    userRoot,
    workspaceStoreRoot,
  }
}

describe('store', () => {
  it('resolves user and workspace .skill-governor paths', async () => {
    const fixture = await createStoreFixture()

    try {
      expect(resolveScopedSkillGovernorRoot(fixture.baseDir, 'user')).toBe(
        join(fixture.baseDir, '.skill-governor', 'user'),
      )
      expect(resolveScopedSkillGovernorRoot(fixture.baseDir, 'workspace')).toBe(
        join(fixture.baseDir, '.skill-governor', 'workspace'),
      )
      expect(resolveRegistryFilePath(fixture.userRoot)).toBe(
        join(fixture.userRoot, 'registry.json'),
      )
      expect(resolveStateFilePath(fixture.workspaceStoreRoot)).toBe(
        join(fixture.workspaceStoreRoot, 'state.json'),
      )
      expect(resolveProfileFilePath(fixture.userRoot, 'minimal')).toBe(
        join(fixture.userRoot, 'profiles', 'minimal.yaml'),
      )
      expect(resolvePlanFilePath(fixture.workspaceStoreRoot, 'plan-123')).toBe(
        join(fixture.workspaceStoreRoot, 'plans', 'plan-123.json'),
      )
      expect(resolveSnapshotFilePath(fixture.workspaceStoreRoot, 'snapshot-123')).toBe(
        join(fixture.workspaceStoreRoot, 'snapshots', 'snapshot-123.json'),
      )
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })

  it('reads and writes registry, state, and plan documents', async () => {
    const fixture = await createStoreFixture()

    const registry: RegistryDocument = {
      version: 1,
      generatedAt: '2026-04-17T00:00:00.000Z',
      workspaceRoot: fixture.workspaceRoot,
      sources: { user: true, workspace: true },
      providers: ['codex', 'cursor', 'claude'],
      skills: [],
    }

    const state: StateDocument = {
      version: 1,
      activeProfile: 'minimal',
      lastAppliedPlanId: 'plan-001',
      selectedSources: ['user', 'workspace'],
      selectedProviders: ['codex', 'cursor'],
      updatedAt: '2026-04-17T00:00:00.000Z',
    }

    const plan: GovernancePlan = {
      version: 1,
      id: 'plan-001',
      createdAt: '2026-04-17T00:00:00.000Z',
      policy: 'conservative',
      summary: {
        totalSkills: 1,
        changedSkills: 0,
        duplicateGroups: 0,
        suggestedProfiles: ['minimal'],
      },
      actions: [],
      profileDrafts: [],
      warnings: [],
    }

    try {
      expect(await readRegistryDocument(fixture.userRoot)).toBeNull()
      expect(await readStateDocument(fixture.workspaceStoreRoot)).toBeNull()
      expect(await readGovernancePlan(fixture.workspaceStoreRoot, plan.id)).toBeNull()

      await writeRegistryDocument(fixture.userRoot, registry)
      await writeStateDocument(fixture.workspaceStoreRoot, state)
      await writeGovernancePlan(fixture.workspaceStoreRoot, plan)

      expect(await readRegistryDocument(fixture.userRoot)).toEqual(registry)
      expect(await readStateDocument(fixture.workspaceStoreRoot)).toEqual(state)
      expect(await readGovernancePlan(fixture.workspaceStoreRoot, plan.id)).toEqual(plan)
      expect(await readJsonFile<RegistryDocument>(resolveRegistryFilePath(fixture.userRoot))).toEqual(
        registry,
      )
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })

  it('captures snapshots with previous state and profiles', async () => {
    const fixture = await createStoreFixture()

    const profile: ProfileDocument = {
      version: 1,
      name: 'minimal',
      description: 'Minimal profile',
      defaults: {
        mode: 'manual',
        priority: 50,
        governanceScope: 'workspace',
      },
      rules: [
        {
          match: {
            provider: ['cursor', 'codex'],
            sourceScope: ['workspace'],
            domain: ['governance'],
          },
          set: {
            mode: 'auto',
            priority: 80,
            governanceScope: 'workspace',
          },
          reason: ['workspace governance'],
        },
      ],
    }

    const state: StateDocument = {
      version: 1,
      activeProfile: 'minimal',
      lastAppliedPlanId: 'plan-001',
      selectedSources: ['user'],
      selectedProviders: ['codex'],
      updatedAt: '2026-04-17T00:00:00.000Z',
    }

    try {
      await writeProfileDocument(fixture.userRoot, profile)
      await writeStateDocument(fixture.userRoot, state)

      const profilePath = resolveProfileFilePath(fixture.userRoot, profile.name)
      const profileText = await readFile(profilePath, 'utf8')

      expect(profileText).toContain('version: 1')
      expect(profileText).toContain('name: minimal')
      expect(profileText).toContain('defaults:')
      expect(profileText).toContain('rules:')
      expect(profileText).toContain('\n  -\n')
      expect(profileText).not.toContain('{')
      expect(profileText).not.toContain('}')
      expect(profileText).not.toContain('"')

      const snapshot = await captureSnapshot({
        storeRoot: fixture.userRoot,
        snapshotId: 'snapshot-001',
        createdAt: '2026-04-17T00:00:00.000Z',
        previousState: state,
        previousProfiles: [profile],
        basedOnPlanId: 'plan-001',
      })

      const expectedSnapshot: SnapshotDocument = {
        version: 1,
        snapshotId: 'snapshot-001',
        createdAt: '2026-04-17T00:00:00.000Z',
        previousState: state,
        previousProfiles: [profile],
        basedOnPlanId: 'plan-001',
      }

      expect(snapshot).toEqual(expectedSnapshot)
      expect(await readSnapshotDocument(fixture.userRoot, snapshot.snapshotId)).toEqual(
        expectedSnapshot,
      )
      expect(await readProfileDocument(fixture.userRoot, profile.name)).toEqual(profile)
    } finally {
      await rm(fixture.baseDir, { recursive: true, force: true })
    }
  })
})
