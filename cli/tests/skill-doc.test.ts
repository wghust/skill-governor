import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const skillDocPath = new URL('../../SKILL.md', import.meta.url)
const examplePlanPath = new URL('../examples/plan.json', import.meta.url)
const exampleReportPath = new URL('../examples/report.md', import.meta.url)

describe('skill-governor skill docs', () => {
  it('uses Anthropic-style skill metadata and governance instructions', async () => {
    const text = await readFile(skillDocPath, 'utf8')

    expect(text).toContain('---')
    expect(text).toContain('name: skill-governor')
    expect(text).toContain('description: Govern local skill inventories')
    expect(text).toContain('# Skill Governor')
    expect(text).toContain('## What this skill does')
    expect(text).toContain('## Working rules')
    expect(text).toContain('## Command mapping')
    expect(text).toContain('## Workflow')
    expect(text).toContain('## Safety')
    expect(text).toContain('## Response guidance')

    expect(text).toContain('bin/skill-governor optimize --policy conservative --format json')
    expect(text).toContain('bin/skill-governor apply --plan')
    expect(text).toContain('bin/skill-governor rollback')
    expect(text).toContain('Never edit raw provider `SKILL.md` files directly.')
    expect(text).toContain('Require explicit confirmation before `apply`.')
    expect(text).toContain('Default to dry-run behavior')
  })

  it('ships plan and report examples aligned with the current governance model', async () => {
    const planText = await readFile(examplePlanPath, 'utf8')
    const reportText = await readFile(exampleReportPath, 'utf8')
    const plan = JSON.parse(planText) as {
      version: number
      policy: string
      summary: { totalSkills: number; duplicateGroups: number }
      actions: unknown[]
      profileDrafts: Array<{ name: string }>
    }

    expect(plan.version).toBe(1)
    expect(plan.policy).toBe('conservative')
    expect(plan.summary.totalSkills).toBeGreaterThan(0)
    expect(plan.summary.duplicateGroups).toBeGreaterThanOrEqual(0)
    expect(plan.actions.length).toBeGreaterThan(0)
    expect(plan.profileDrafts[0]?.name).toBe('conservative')

    expect(reportText).toContain('# Skill Governor Report')
    expect(reportText).toContain('skill-governor apply --plan')
    expect(reportText).toContain('Active profile:')
  })
})
