import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildCli } from '../src/cli.js'
import { writeGovernancePlan } from '../src/store/plans.js'
import { readStateDocument } from '../src/store/state.js'

async function createFixture(): Promise<{
  root: string
  homeDir: string
  workspaceRoot: string
  storeRoot: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'skill-governor-e2e-'))
  const homeDir = join(root, 'home')
  const workspaceRoot = join(root, 'workspace')
  const storeRoot = join(workspaceRoot, '.skill-governor')

  await mkdir(join(homeDir, '.codex', 'skills', 'governance-core-user'), { recursive: true })
  await mkdir(join(workspaceRoot, '.cursor', 'skills', 'governance-core-workspace'), { recursive: true })

  await writeFile(
    join(homeDir, '.codex', 'skills', 'governance-core-user', 'SKILL.md'),
    [
      '---',
      'name: Governance Core',
      'description: Shared governance entrypoint',
      'tags: [core, governance]',
      '---',
      '# Governance Core',
      '',
      'Shared governance entrypoint.',
      '',
    ].join('\n'),
    'utf8',
  )

  await writeFile(
    join(workspaceRoot, '.cursor', 'skills', 'governance-core-workspace', 'SKILL.md'),
    [
      '---',
      'name: Governance Core',
      'description: Shared governance entrypoint',
      'tags: [core, governance]',
      '---',
      '# Governance Core',
      '',
      'Shared governance entrypoint.',
      '',
    ].join('\n'),
    'utf8',
  )

  return { root, homeDir, workspaceRoot, storeRoot }
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

describe('e2e smoke', () => {
  let fixture: Awaited<ReturnType<typeof createFixture>> | null = null

  afterEach(async () => {
    if (fixture) {
      await rm(fixture.root, { recursive: true, force: true })
      fixture = null
    }
  })

  it('scans, optimizes, applies, and reports through the CLI', async () => {
    fixture = await createFixture()

    const optimizeOutput = await runCli([
      'optimize',
      '--policy',
      'conservative',
      '--workspace-root',
      fixture.workspaceRoot,
      '--home-dir',
      fixture.homeDir,
      '--format',
      'json',
    ])

    const optimizeResult = JSON.parse(optimizeOutput) as {
      ok: boolean
      data: {
        id: string
        policy: string
        summary: { totalSkills: number; duplicateGroups: number; changedSkills: number }
        profileDrafts: Array<{ name: string }>
      }
    }

    expect(optimizeResult.ok).toBe(true)
    expect(optimizeResult.data.policy).toBe('conservative')
    expect(optimizeResult.data.summary.totalSkills).toBe(2)
    expect(optimizeResult.data.summary.duplicateGroups).toBe(1)

    await writeGovernancePlan(fixture.storeRoot, optimizeResult.data as never)

    const applyOutput = await runCli([
      'apply',
      '--plan',
      optimizeResult.data.id,
      '--store-root',
      fixture.storeRoot,
      '--format',
      'json',
    ])

    const applyResult = JSON.parse(applyOutput) as {
      ok: boolean
      data: {
        applied: boolean
        planId: string
        state: { activeProfile: string | null; lastAppliedPlanId: string | null }
      }
    }

    expect(applyResult.ok).toBe(true)
    expect(applyResult.data.applied).toBe(true)
    expect(applyResult.data.planId).toBe(optimizeResult.data.id)
    expect(applyResult.data.state.activeProfile).toBe('conservative')

    const storedState = await readStateDocument(fixture.storeRoot)
    expect(storedState?.lastAppliedPlanId).toBe(optimizeResult.data.id)

    const reportOutput = await runCli([
      'report',
      '--workspace-root',
      fixture.workspaceRoot,
      '--home-dir',
      fixture.homeDir,
      '--format',
      'json',
    ])

    const reportResult = JSON.parse(reportOutput) as {
      ok: boolean
      data: {
        audit: { totalSkills: number }
        duplicateGroups: Array<{ id: string }>
      }
    }

    expect(reportResult.ok).toBe(true)
    expect(reportResult.data.audit.totalSkills).toBe(2)
    expect(reportResult.data.duplicateGroups).toHaveLength(1)
  })
})
