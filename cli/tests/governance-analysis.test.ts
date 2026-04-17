import { describe, expect, it } from 'vitest'

import type { SkillRecord } from '../src/types.js'

import { createAuditSummary } from '../src/governance/audit.js'
import { createSkillClusters } from '../src/governance/cluster.js'
import { findDuplicateGroups } from '../src/governance/dedupe.js'

function createSkill(overrides: Partial<SkillRecord> & Pick<SkillRecord, 'id' | 'name'>): SkillRecord {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? '',
    provider: overrides.provider ?? 'codex',
    sourceScope: overrides.sourceScope ?? 'user',
    path: overrides.path ?? `/skills/${overrides.id}`,
    entryFile: overrides.entryFile ?? `/skills/${overrides.id}/SKILL.md`,
    domain: overrides.domain ?? 'general',
    tags: overrides.tags ?? [],
    projects: overrides.projects,
    currentMode: overrides.currentMode ?? 'manual',
    currentPriority: overrides.currentPriority ?? 50,
    currentGovernanceScope: overrides.currentGovernanceScope ?? 'workspace',
    fingerprints: overrides.fingerprints ?? {
      nameNorm: overrides.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, ''),
      descHash: overrides.description ? `hash-${overrides.id}` : `hash-empty`,
      tokenSet: buildTokenSet(overrides.name, overrides.description ?? '', overrides.tags ?? [], overrides.domain ?? 'general'),
    },
    metadata: overrides.metadata ?? {
      parseWarnings: [],
      inferred: false,
      discoveredAt: '2026-04-17T00:00:00.000Z',
    },
  }
}

function buildTokenSet(
  name: string,
  description: string,
  tags: readonly string[],
  domain: string,
): string[] {
  const tokens = new Set<string>()

  for (const token of [name, description, domain, ...tags]) {
    for (const piece of token.toLowerCase().split(/[^a-z0-9]+/u)) {
      const normalized = piece.trim()
      if (normalized.length > 0) {
        tokens.add(normalized)
      }
    }
  }

  return [...tokens].sort((left, right) => left.localeCompare(right))
}

describe('governance analysis', () => {
  it('summarizes totals by provider, source scope, mode, inferred, and warnings', () => {
    const skills = [
      createSkill({
        id: 'skill-1',
        name: 'Search Audit',
        provider: 'codex',
        sourceScope: 'user',
        currentMode: 'manual',
        metadata: {
          parseWarnings: [],
          inferred: false,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
      createSkill({
        id: 'skill-2',
        name: 'Search Console Debug',
        provider: 'cursor',
        sourceScope: 'workspace',
        currentMode: 'auto',
        metadata: {
          parseWarnings: ['Missing frontmatter description'],
          inferred: true,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
      createSkill({
        id: 'skill-3',
        name: 'Audit Search Visibility',
        provider: 'claude',
        sourceScope: 'workspace',
        currentMode: 'manual',
        metadata: {
          parseWarnings: ['Unparsed frontmatter line: bad-line', 'Missing tags'],
          inferred: true,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
      createSkill({
        id: 'skill-4',
        name: 'Next.js Debug',
        provider: 'custom',
        sourceScope: 'user',
        currentMode: 'off',
        metadata: {
          parseWarnings: [],
          inferred: false,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
      createSkill({
        id: 'skill-5',
        name: 'GSC Audit',
        provider: 'codex',
        sourceScope: 'workspace',
        currentMode: 'manual',
        metadata: {
          parseWarnings: [],
          inferred: false,
          discoveredAt: '2026-04-17T00:00:00.000Z',
        },
      }),
    ]

    const summary = createAuditSummary(skills)

    expect(summary).toEqual({
      totalSkills: 5,
      byProvider: {
        cursor: 1,
        codex: 2,
        claude: 1,
        custom: 1,
      },
      bySourceScope: {
        user: 2,
        workspace: 3,
      },
      byMode: {
        auto: 1,
        manual: 3,
        off: 1,
      },
      inferredCount: 2,
      warningCount: 3,
    })
  })

  it('groups duplicate skills with primary and secondary suggestions', () => {
    const skills = [
      createSkill({
        id: 'primary-exact',
        name: 'Next.js Debug',
        provider: 'codex',
        sourceScope: 'workspace',
        domain: 'frontend',
        tags: ['nextjs', 'debug'],
        currentPriority: 80,
      }),
      createSkill({
        id: 'secondary-exact',
        name: 'Next.js Debug',
        provider: 'cursor',
        sourceScope: 'user',
        domain: 'frontend',
        tags: ['nextjs', 'debug'],
        currentPriority: 40,
      }),
      createSkill({
        id: 'primary-heuristic',
        name: 'Search Console Audit',
        provider: 'claude',
        sourceScope: 'workspace',
        domain: 'seo',
        tags: ['search', 'console', 'audit'],
        currentPriority: 70,
      }),
      createSkill({
        id: 'secondary-heuristic',
        name: 'Audit Search Console',
        provider: 'cursor',
        sourceScope: 'user',
        domain: 'seo',
        tags: ['audit', 'search', 'console'],
        currentPriority: 30,
      }),
    ]

    const report = findDuplicateGroups(skills)

    expect(report.threshold).toBeCloseTo(0.66)
    expect(report.groups).toHaveLength(2)

    const exactGroup = report.groups.find((group) => group.key === 'name:next-js-debug')
    expect(exactGroup).toBeDefined()
    expect(exactGroup?.primary.skill.id).toBe('primary-exact')
    expect(exactGroup?.secondaries.map((candidate) => candidate.skill.id)).toEqual([
      'secondary-exact',
    ])
    expect(exactGroup?.reasons).toContain('normalized name equality')

    const heuristicGroup = report.groups.find((group) => group.key.startsWith('tokens:'))
    expect(heuristicGroup).toBeDefined()
    expect(heuristicGroup?.primary.skill.id).toBe('primary-heuristic')
    expect(heuristicGroup?.secondaries.map((candidate) => candidate.skill.id)).toEqual([
      'secondary-heuristic',
    ])
    expect(heuristicGroup?.reasons).toEqual(
      expect.arrayContaining([
        'normalized name token overlap',
        'tag overlap',
        'domain overlap',
      ]),
    )
  })

  it('clusters skills by domain and useful heuristic keywords', () => {
    const skills = [
      createSkill({
        id: 'seo-1',
        name: 'Search Audit',
        provider: 'codex',
        sourceScope: 'workspace',
        domain: 'seo',
        tags: ['search', 'audit'],
      }),
      createSkill({
        id: 'seo-2',
        name: 'Search Console Debug',
        provider: 'cursor',
        sourceScope: 'user',
        domain: 'seo',
        tags: ['search', 'gsc'],
      }),
      createSkill({
        id: 'seo-3',
        name: 'Search Visibility Report',
        provider: 'claude',
        sourceScope: 'workspace',
        domain: 'seo',
        tags: ['search', 'visibility'],
      }),
      createSkill({
        id: 'frontend-1',
        name: 'Next.js Debug',
        provider: 'cursor',
        sourceScope: 'workspace',
        domain: 'frontend',
        tags: ['nextjs', 'debug'],
      }),
    ]

    const report = createSkillClusters(skills)

    expect(report.domainCount).toBe(2)
    expect(report.keywordCount).toBe(1)
    expect(report.clusters.map((cluster) => cluster.label)).toEqual([
      'frontend',
      'seo/search',
    ])

    const seoCluster = report.clusters.find((cluster) => cluster.label === 'seo/search')
    expect(seoCluster).toBeDefined()
    expect(seoCluster?.domain).toBe('seo')
    expect(seoCluster?.keyword).toBe('search')
    expect(seoCluster?.skills.map((skill) => skill.id)).toEqual([
      'seo-1',
      'seo-2',
      'seo-3',
    ])

    const frontendCluster = report.clusters.find((cluster) => cluster.label === 'frontend')
    expect(frontendCluster?.keyword).toBeNull()
    expect(frontendCluster?.skills.map((skill) => skill.id)).toEqual([
      'frontend-1',
    ])
  })
})
