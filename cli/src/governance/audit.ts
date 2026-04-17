import type { GovernanceMode, Provider, SkillRecord, SourceScope } from '../types.js'

export interface GovernanceAuditSummary {
  totalSkills: number
  byProvider: Record<Provider, number>
  bySourceScope: Record<SourceScope, number>
  byMode: Record<GovernanceMode, number>
  inferredCount: number
  warningCount: number
}

const PROVIDERS: readonly Provider[] = ['cursor', 'codex', 'claude', 'custom']
const SOURCE_SCOPES: readonly SourceScope[] = ['user', 'workspace']
const MODES: readonly GovernanceMode[] = ['auto', 'manual', 'off']

export function createAuditSummary(
  skills: readonly SkillRecord[],
): GovernanceAuditSummary {
  const byProvider = createCounts(PROVIDERS)
  const bySourceScope = createCounts(SOURCE_SCOPES)
  const byMode = createCounts(MODES)

  let inferredCount = 0
  let warningCount = 0

  for (const skill of skills) {
    byProvider[skill.provider] += 1
    bySourceScope[skill.sourceScope] += 1
    byMode[skill.currentMode] += 1

    if (skill.metadata.inferred) {
      inferredCount += 1
    }

    warningCount += skill.metadata.parseWarnings.length
  }

  return {
    totalSkills: skills.length,
    byProvider,
    bySourceScope,
    byMode,
    inferredCount,
    warningCount,
  }
}

function createCounts<T extends string>(values: readonly T[]): Record<T, number> {
  return values.reduce((accumulator, value) => {
    accumulator[value] = 0
    return accumulator
  }, {} as Record<T, number>)
}
