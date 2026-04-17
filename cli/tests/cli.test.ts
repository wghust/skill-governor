import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCli } from '../src/cli'
import { resolveWorkspaceSkillGovernorRoot } from '../src/store/paths'
import { readGovernancePlan } from '../src/store/plans'

async function createEmptyRoots(): Promise<{ workspaceRoot: string; homeDir: string }> {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'skill-governor-workspace-'))
  const homeDir = await mkdtemp(join(tmpdir(), 'skill-governor-home-'))
  return { workspaceRoot, homeDir }
}

async function removeRoots(roots: { workspaceRoot: string; homeDir: string } | null): Promise<void> {
  if (!roots) {
    return
  }

  await Promise.all([
    rm(roots.workspaceRoot, { recursive: true, force: true }),
    rm(roots.homeDir, { recursive: true, force: true }),
  ])
}

async function runCli(argv: string[]): Promise<string> {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  try {
    await buildCli().parseAsync(argv, { from: 'user' })
    return logSpy.mock.calls.map((call) => call.map((item) => String(item)).join(' ')).join('\n')
  } finally {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  }
}

describe('CLI wiring', () => {
  let roots: { workspaceRoot: string; homeDir: string } | null = null

  afterEach(async () => {
    await removeRoots(roots)
    roots = null
  })

  it('prints a JSON envelope for list', async () => {
    roots = await createEmptyRoots()
    const output = await runCli([
      'list',
      '--workspace-root',
      roots.workspaceRoot,
      '--home-dir',
      roots.homeDir,
      '--format',
      'json',
    ])

    const parsed = JSON.parse(output) as { ok: boolean; data: { workspaceRoot: string; skills: unknown[]; sources: { user: boolean; workspace: boolean } } }
    expect(parsed.ok).toBe(true)
    expect(parsed.data.workspaceRoot).toBe(roots.workspaceRoot)
    expect(parsed.data.skills).toEqual([])
    expect(parsed.data.sources).toEqual({ user: false, workspace: false })
  })

  it('prints a JSON envelope for audit', async () => {
    roots = await createEmptyRoots()
    const output = await runCli([
      'audit',
      '--workspace-root',
      roots.workspaceRoot,
      '--home-dir',
      roots.homeDir,
      '--format',
      'json',
    ])

    const parsed = JSON.parse(output) as { ok: boolean; data: { workspaceRoot: string; summary: { totalSkills: number; inferredCount: number; warningCount: number } } }
    expect(parsed.ok).toBe(true)
    expect(parsed.data.workspaceRoot).toBe(roots.workspaceRoot)
    expect(parsed.data.summary.totalSkills).toBe(0)
    expect(parsed.data.summary.inferredCount).toBe(0)
    expect(parsed.data.summary.warningCount).toBe(0)
  })

  it('prints a JSON envelope for optimize with the requested policy', async () => {
    roots = await createEmptyRoots()
    const output = await runCli([
      'optimize',
      '--policy',
      'conservative',
      '--workspace-root',
      roots.workspaceRoot,
      '--home-dir',
      roots.homeDir,
      '--format',
      'json',
    ])

    const parsed = JSON.parse(output) as {
      ok: boolean
      data: {
        id: string
        policy: string
        dryRun: boolean
        storeRoot: string
        summary: { totalSkills: number; duplicateGroups: number }
        profileDrafts: Array<{ name: string }>
      }
    }

    expect(parsed.ok).toBe(true)
    expect(parsed.data.policy).toBe('conservative')
    expect(parsed.data.dryRun).toBe(true)
    expect(parsed.data.storeRoot).toBe(resolveWorkspaceSkillGovernorRoot(roots.workspaceRoot))
    expect(parsed.data.summary.totalSkills).toBe(0)
    expect(parsed.data.summary.duplicateGroups).toBe(0)
    expect(parsed.data.profileDrafts[0]?.name).toBe('conservative')

    const persisted = await readGovernancePlan(parsed.data.storeRoot, parsed.data.id)
    expect(persisted?.id).toBe(parsed.data.id)
  })

  it('registers apply, rollback, and profile use commands', () => {
    const program = buildCli()
    const rootNames = program.commands.map((command) => command.name())

    expect(rootNames).toEqual(expect.arrayContaining(['apply', 'rollback', 'profile']))

    const profile = program.commands.find((command) => command.name() === 'profile')
    expect(profile?.commands.map((command) => command.name())).toEqual(expect.arrayContaining(['use']))
  })
})
