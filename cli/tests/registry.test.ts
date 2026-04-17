import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  normalizeSkillCandidate,
  scanAndNormalizeRegistry,
  scanSkillCandidates,
} from '../src/registry/index.js'

async function createWorkspaceFixture(): Promise<{
  homeDir: string
  workspaceRoot: string
}> {
  const baseDir = await mkdtemp(join(tmpdir(), 'skill-governor-registry-'))
  const homeDir = join(baseDir, 'home')
  const workspaceRoot = join(baseDir, 'workspace')

  await mkdir(join(homeDir, '.codex', 'skills', 'user-ops'), { recursive: true })
  await mkdir(join(workspaceRoot, '.cursor', 'skills', 'workspace-ops'), { recursive: true })

  await writeFile(
    join(homeDir, '.codex', 'skills', 'user-ops', 'SKILL.md'),
    [
      '---',
      'name: User Ops',
      'description: Manage user-level operations',
      'tags: [ops, user]',
      '---',
      '# User Ops',
      '',
      'Manages user level flows.',
      '',
    ].join('\n'),
  )

  await writeFile(
    join(workspaceRoot, '.cursor', 'skills', 'workspace-ops', 'SKILL.md'),
    [
      '---',
      'name: Workspace Ops',
      'description: Manage workspace-level operations',
      'tags:',
      '  - workspace',
      '  - ops',
      '---',
      '# Workspace Ops',
      '',
      'Manages workspace level flows.',
      '',
    ].join('\n'),
  )

  return { homeDir, workspaceRoot }
}

async function createWarningFixture(): Promise<{
  homeDir: string
  workspaceRoot: string
}> {
  const baseDir = await mkdtemp(join(tmpdir(), 'skill-governor-registry-warnings-'))
  const homeDir = join(baseDir, 'home')
  const workspaceRoot = join(baseDir, 'workspace')

  await mkdir(join(homeDir, '.claude', 'skills', 'warned'), { recursive: true })

  await writeFile(
    join(homeDir, '.claude', 'skills', 'warned', 'SKILL.md'),
    [
      '---',
      'name: Warned Skill',
      'bad-line-without-colon',
      'description: Skill with a warning',
      '---',
      '# Warned Skill',
      '',
      'This file contains a malformed frontmatter line.',
      '',
    ].join('\n'),
  )

  return { homeDir, workspaceRoot }
}

describe('registry', () => {
  it('discovers user and workspace skills from enabled providers', async () => {
    const fixture = await createWorkspaceFixture()

    try {
      const candidates = await scanSkillCandidates({
        homeDir: fixture.homeDir,
        workspaceRoot: fixture.workspaceRoot,
        providers: ['codex', 'cursor'],
        sourceScopes: ['user', 'workspace'],
      })

      expect(candidates).toEqual([
        expect.objectContaining({
          provider: 'codex',
          sourceScope: 'user',
          entryFile: join(fixture.homeDir, '.codex', 'skills', 'user-ops', 'SKILL.md'),
        }),
        expect.objectContaining({
          provider: 'cursor',
          sourceScope: 'workspace',
          entryFile: join(
            fixture.workspaceRoot,
            '.cursor',
            'skills',
            'workspace-ops',
            'SKILL.md',
          ),
        }),
      ])
    } finally {
      await rm(join(fixture.homeDir, '..'), { recursive: true, force: true })
    }
  })

  it('normalizes records with stable ids and fallback governance defaults', async () => {
    const fixture = await createWorkspaceFixture()

    try {
      const registry = await scanAndNormalizeRegistry({
        homeDir: fixture.homeDir,
        workspaceRoot: fixture.workspaceRoot,
        providers: ['codex', 'cursor'],
        sourceScopes: ['user', 'workspace'],
      })

      expect(registry.skills).toHaveLength(2)
      expect(registry).toMatchObject({
        version: 1,
        workspaceRoot: fixture.workspaceRoot,
        sources: {
          user: true,
          workspace: true,
        },
        providers: ['codex', 'cursor'],
      })

      const [userSkill, workspaceSkill] = registry.skills
      expect(userSkill.currentMode).toBe('manual')
      expect(userSkill.currentPriority).toBe(50)
      expect(userSkill.currentGovernanceScope).toBe('workspace')
      expect(workspaceSkill.currentMode).toBe('manual')
      expect(workspaceSkill.currentPriority).toBe(50)
      expect(workspaceSkill.currentGovernanceScope).toBe('workspace')

      const repeatRegistry = await scanAndNormalizeRegistry({
        homeDir: fixture.homeDir,
        workspaceRoot: fixture.workspaceRoot,
        providers: ['codex', 'cursor'],
        sourceScopes: ['user', 'workspace'],
      })

      expect(repeatRegistry.skills.map((skill) => skill.id)).toEqual(
        registry.skills.map((skill) => skill.id),
      )
      expect(userSkill.fingerprints.nameNorm).toBe('user-ops')
      expect(userSkill.fingerprints.descHash).toHaveLength(16)
      expect(userSkill.fingerprints.tokenSet).toEqual(
        expect.arrayContaining([
          'manage',
          'operations',
          'ops',
          'user',
          'user-ops',
          'level',
        ]),
      )
    } finally {
      await rm(join(fixture.homeDir, '..'), { recursive: true, force: true })
    }
  })

  it('preserves parse warnings during normalization', async () => {
    const fixture = await createWarningFixture()

    try {
      const candidates = await scanSkillCandidates({
        homeDir: fixture.homeDir,
        workspaceRoot: fixture.workspaceRoot,
        providers: ['claude'],
        sourceScopes: ['user'],
      })

      expect(candidates).toHaveLength(1)

      const normalized = await normalizeSkillCandidate(candidates[0])
      expect(normalized.name).toBe('Warned Skill')
      expect(normalized.metadata.parseWarnings).toEqual([
        'Unparsed frontmatter line: bad-line-without-colon',
      ])
      expect(normalized.metadata.inferred).toBe(true)
    } finally {
      await rm(join(fixture.homeDir, '..'), { recursive: true, force: true })
    }
  })
})
