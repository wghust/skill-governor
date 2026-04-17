import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  detectLegacyWorkspaceSkillGovernorRoot,
  resolveScopedSkillGovernorRoot,
  resolveSkillHome,
} from '../src/store/paths.js'

describe('store path resolution', () => {
  it('resolves the skill home by walking upward to SKILL.md', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-governor-home-'))
    const nestedFile = join(root, 'cli', 'dist', 'store', 'paths.js')

    try {
      await writeFile(join(root, 'SKILL.md'), '# Skill Governor\n', 'utf8')
      expect(resolveSkillHome(nestedFile)).toBe(root)
      expect(resolveScopedSkillGovernorRoot(root, 'workspace')).toBe(join(root, '.skill-governor', 'workspace'))
      expect(resolveScopedSkillGovernorRoot(root, 'user')).toBe(join(root, '.skill-governor', 'user'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('detects a legacy workspace-local store when it differs from the skill-owned store', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'skill-governor-workspace-'))

    try {
      const legacyStore = join(workspaceRoot, '.skill-governor')
      await mkdir(legacyStore, { recursive: true })
      await writeFile(join(legacyStore, '.keep'), '', 'utf8')

      const currentStore = join(tmpdir(), 'skill-governor-home', '.skill-governor', 'workspace')
      expect(detectLegacyWorkspaceSkillGovernorRoot(workspaceRoot, currentStore)).toBe(legacyStore)
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})
