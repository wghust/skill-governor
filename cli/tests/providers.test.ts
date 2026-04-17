import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  BUILTIN_PROVIDER_IDS,
  getProviderAdapter,
  listProviderAdapters,
} from '../src/providers/index.js'

const createdPaths: string[] = []

afterEach(async () => {
  while (createdPaths.length > 0) {
    const path = createdPaths.pop()
    if (path) {
      await rm(path, { recursive: true, force: true })
    }
  }
})

describe('provider adapters', () => {
  it('exposes deterministic built-in provider ids and lookup', () => {
    expect(BUILTIN_PROVIDER_IDS).toEqual(['cursor', 'codex', 'claude'])
    expect(getProviderAdapter('codex').provider).toBe('codex')
    expect(listProviderAdapters().map((adapter) => adapter.provider)).toEqual([
      'cursor',
      'codex',
      'claude',
    ])
  })

  it('exposes default user and workspace roots for each provider', () => {
    const homeDir = '/home/alex'
    const workspaceRoot = '/workspace/project'

    expect(getProviderAdapter('cursor').getDefaultUserRoots(homeDir)).toEqual([
      '/home/alex/.cursor/skills',
    ])
    expect(getProviderAdapter('cursor').getDefaultWorkspaceRoots(workspaceRoot)).toEqual([
      '/workspace/project/.cursor/skills',
    ])

    expect(getProviderAdapter('codex').getDefaultUserRoots(homeDir)).toEqual([
      '/home/alex/.codex/skills',
    ])
    expect(getProviderAdapter('codex').getDefaultWorkspaceRoots(workspaceRoot)).toEqual([
      '/workspace/project/.codex/skills',
    ])

    expect(getProviderAdapter('claude').getDefaultUserRoots(homeDir)).toEqual([
      '/home/alex/.claude/skills',
    ])
    expect(getProviderAdapter('claude').getDefaultWorkspaceRoots(workspaceRoot)).toEqual([
      '/workspace/project/.claude/skills',
    ])
  })

  it('discovers SKILL.md entries and parses basic metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-governor-provider-'))
    createdPaths.push(root)

    const nestedRoot = join(root, '.codex', 'skills', 'seo')
    await mkdir(nestedRoot, { recursive: true })

    const skillPath = join(nestedRoot, 'SKILL.md')
    await writeFile(
      skillPath,
      `---\nname: Search Audit\ndescription: Evaluate search visibility.\ntags: [seo, audit]\n---\n\n# Search Audit\n\nEvaluate search visibility.\n`,
      'utf8',
    )

    const candidates = await getProviderAdapter('codex').findSkillEntryCandidates(
      join(root, '.codex', 'skills'),
    )
    expect(candidates).toEqual([skillPath])

    const parsed = await getProviderAdapter('codex').parseSkill(skillPath)
    expect(parsed.provider).toBe('codex')
    expect(parsed.name).toBe('Search Audit')
    expect(parsed.description).toBe('Evaluate search visibility.')
    expect(parsed.domain).toBe('seo')
    expect(parsed.tags).toContain('seo')
    expect(parsed.tags).toContain('audit')
    expect(parsed.metadata?.parseWarnings).toEqual([])
  })
})
