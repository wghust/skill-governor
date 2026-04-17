import type {
  GovernanceMode,
  GovernancePolicy,
  GovernanceScope,
  ProfileDefaults,
  ProfileDocument,
  ProfileRule,
  ProfileRuleMatch,
  ProfileRuleSet,
  SkillRecord,
} from '../types.js'
import type { DuplicateGroup } from './dedupe.js'

export type SkillTier = 'core' | 'domain' | 'project' | 'experimental'

export interface PolicyConfig {
  policy: GovernancePolicy
  duplicateThreshold: number
  profileDefaults: ProfileDefaults
  modeByTier: Record<SkillTier, GovernanceMode>
  priorityByTier: Record<SkillTier, number>
  workspacePriorityBonus: number
  duplicatePrimaryPriorityBonus: number
  duplicateSecondaryPriorityPenalty: number
  duplicatePrimaryMode: GovernanceMode
  duplicateSecondaryMode: GovernanceMode
  profileName: string
  profileDescription: string
}

const CORE_NAME_MARKERS = [
  'audit',
  'cluster',
  'core',
  'dedupe',
  'governance',
  'governor',
  'optimize',
  'profile',
  'registry',
]

const EXPERIMENTAL_MARKERS = [
  'beta',
  'experimental',
  'lab',
  'poc',
  'prototype',
  'sandbox',
  'spike',
]

const PROJECT_MARKERS = [
  'project',
  'workspace',
  'repo-specific',
  'repo',
  'task-specific',
]

const POLICY_CONFIGS: Record<GovernancePolicy, PolicyConfig> = {
  conservative: {
    policy: 'conservative',
    duplicateThreshold: 0.8,
    profileDefaults: {
      mode: 'manual',
      priority: 60,
      governanceScope: 'workspace',
    },
    modeByTier: {
      core: 'auto',
      domain: 'manual',
      project: 'manual',
      experimental: 'off',
    },
    priorityByTier: {
      core: 86,
      domain: 72,
      project: 58,
      experimental: 12,
    },
    workspacePriorityBonus: 6,
    duplicatePrimaryPriorityBonus: 4,
    duplicateSecondaryPriorityPenalty: 30,
    duplicatePrimaryMode: 'auto',
    duplicateSecondaryMode: 'off',
    profileName: 'conservative',
    profileDescription: 'Conservative governance profile generated from a dry-run optimize plan.',
  },
  balanced: {
    policy: 'balanced',
    duplicateThreshold: 0.7,
    profileDefaults: {
      mode: 'manual',
      priority: 55,
      governanceScope: 'workspace',
    },
    modeByTier: {
      core: 'auto',
      domain: 'auto',
      project: 'manual',
      experimental: 'off',
    },
    priorityByTier: {
      core: 90,
      domain: 78,
      project: 64,
      experimental: 10,
    },
    workspacePriorityBonus: 8,
    duplicatePrimaryPriorityBonus: 6,
    duplicateSecondaryPriorityPenalty: 24,
    duplicatePrimaryMode: 'auto',
    duplicateSecondaryMode: 'manual',
    profileName: 'balanced',
    profileDescription: 'Balanced governance profile generated from a dry-run optimize plan.',
  },
  aggressive: {
    policy: 'aggressive',
    duplicateThreshold: 0.56,
    profileDefaults: {
      mode: 'auto',
      priority: 70,
      governanceScope: 'workspace',
    },
    modeByTier: {
      core: 'auto',
      domain: 'auto',
      project: 'auto',
      experimental: 'off',
    },
    priorityByTier: {
      core: 96,
      domain: 86,
      project: 74,
      experimental: 6,
    },
    workspacePriorityBonus: 12,
    duplicatePrimaryPriorityBonus: 8,
    duplicateSecondaryPriorityPenalty: 34,
    duplicatePrimaryMode: 'auto',
    duplicateSecondaryMode: 'off',
    profileName: 'aggressive',
    profileDescription: 'Aggressive governance profile generated from a dry-run optimize plan.',
  },
}

export function getPolicyConfig(policy: GovernancePolicy): PolicyConfig {
  return POLICY_CONFIGS[policy]
}

export function classifySkill(skill: SkillRecord): SkillTier {
  const normalizedTokens = collectNormalizedTokens(skill)

  if (matchesAny(normalizedTokens, EXPERIMENTAL_MARKERS)) {
    return 'experimental'
  }

  if (
    matchesAny(normalizedTokens, CORE_NAME_MARKERS)
    || matchesAny(skill.tags, CORE_NAME_MARKERS)
  ) {
    return 'core'
  }

  if (
    skill.projects !== undefined
    && skill.projects.length > 0
    || matchesAny(normalizedTokens, PROJECT_MARKERS)
  ) {
    return 'project'
  }

  return 'domain'
}

export function selectPrimarySkill(
  candidates: readonly SkillRecord[],
  policy: GovernancePolicy,
): SkillRecord {
  if (candidates.length === 0) {
    throw new Error(`Cannot select primary skill from an empty candidate list for policy ${policy}`)
  }

  const sorted = [...candidates].sort((left, right) => comparePrimarySkills(left, right, policy))
  return sorted[0]
}

export function buildTargetSide(
  skill: SkillRecord,
  policy: GovernancePolicy,
  role: 'primary' | 'secondary' | 'normal',
): {
  mode: GovernanceMode
  priority: number
  governanceScope: GovernanceScope
} {
  const config = getPolicyConfig(policy)
  const tier = classifySkill(skill)
  const scope = config.profileDefaults.governanceScope
  const basePriority = config.priorityByTier[tier]
  const sourceBonus = skill.sourceScope === 'workspace' ? config.workspacePriorityBonus : 0
  const roleBonus = role === 'primary'
    ? config.duplicatePrimaryPriorityBonus
    : role === 'secondary'
      ? -config.duplicateSecondaryPriorityPenalty
      : 0

  return {
    mode:
      role === 'secondary'
        ? config.duplicateSecondaryMode
        : role === 'primary'
          ? config.duplicatePrimaryMode
          : config.modeByTier[tier],
    priority: clampPriority(basePriority + sourceBonus + roleBonus),
    governanceScope: scope,
  }
}

export function buildProfileDraft(
  policy: GovernancePolicy,
  skills: readonly SkillRecord[],
  duplicateGroups: readonly DuplicateGroup[],
): ProfileDocument {
  const config = getPolicyConfig(policy)
  const usedTiers = new Set<SkillTier>(skills.map((skill) => classifySkill(skill)))
  const rules: ProfileRule[] = []

  rules.push({
    match: {
      tags: ['duplicate-secondary'],
    },
    set: {
      mode: config.duplicateSecondaryMode,
      priority: clampPriority(config.profileDefaults.priority - config.duplicateSecondaryPriorityPenalty),
      governanceScope: config.profileDefaults.governanceScope,
    },
    reason: [
      'secondary skills from duplicate groups are demoted',
      `policy:${config.policy}`,
    ],
  })

  for (const tier of ['core', 'domain', 'project', 'experimental'] as const) {
    if (!usedTiers.has(tier)) {
      continue
    }

    rules.push({
      match: {
        tags: [tier],
      },
      set: {
        mode: config.modeByTier[tier],
        priority: config.priorityByTier[tier],
        governanceScope: config.profileDefaults.governanceScope,
      },
      reason: [`classification tier:${tier}`, `policy:${config.policy}`],
    })
  }

  if (skills.some((skill) => skill.sourceScope === 'workspace')) {
    rules.push({
      match: {
        sourceScope: ['workspace'],
      },
      set: {
        priority: clampPriority(config.profileDefaults.priority + config.workspacePriorityBonus),
        governanceScope: config.profileDefaults.governanceScope,
      },
      reason: [
        'workspace skills receive a higher precedence than user skills',
        `policy:${config.policy}`,
      ],
    })
  }

  if (duplicateGroups.length > 0) {
    rules.push({
      match: {
        provider: ['cursor', 'codex', 'claude', 'custom'],
      },
      set: {
        governanceScope: config.profileDefaults.governanceScope,
      },
      reason: [
        `generated from ${duplicateGroups.length} duplicate group(s)`,
        `policy:${config.policy}`,
      ],
    })
  }

  return {
    version: 1,
    name: config.profileName,
    description: config.profileDescription,
    defaults: config.profileDefaults,
    rules,
  }
}

function comparePrimarySkills(
  left: SkillRecord,
  right: SkillRecord,
  policy: GovernancePolicy,
): number {
  const sourceScopeRank = compareSourceScopes(left.sourceScope, right.sourceScope)
  if (sourceScopeRank !== 0) {
    return sourceScopeRank
  }

  const tierRank = compareTiers(classifySkill(left), classifySkill(right), policy)
  if (tierRank !== 0) {
    return tierRank
  }

  const warningRank = left.metadata.parseWarnings.length - right.metadata.parseWarnings.length
  if (warningRank !== 0) {
    return warningRank
  }

  const modeRank = compareModes(left.currentMode, right.currentMode)
  if (modeRank !== 0) {
    return modeRank
  }

  const priorityRank = right.currentPriority - left.currentPriority
  if (priorityRank !== 0) {
    return priorityRank
  }

  const nameRank = left.name.localeCompare(right.name)
  if (nameRank !== 0) {
    return nameRank
  }

  return left.id.localeCompare(right.id)
}

function compareSourceScopes(left: SkillRecord['sourceScope'], right: SkillRecord['sourceScope']): number {
  if (left === right) {
    return 0
  }

  return left === 'workspace' ? -1 : 1
}

function compareTiers(left: SkillTier, right: SkillTier, policy: GovernancePolicy): number {
  if (left === right) {
    return 0
  }

  const config = getPolicyConfig(policy)
  const ranking: Record<SkillTier, number> = (() => {
    switch (config.policy) {
      case 'conservative':
        return {
          core: 0,
          domain: 1,
          project: 2,
          experimental: 3,
        }
      case 'balanced':
        return {
          core: 0,
          domain: 1,
          project: 2,
          experimental: 3,
        }
      case 'aggressive':
        return {
          core: 0,
          domain: 1,
          project: 2,
          experimental: 3,
        }
      default:
        return {
          core: 0,
          domain: 1,
          project: 2,
          experimental: 3,
        }
    }
  })()

  return ranking[left] - ranking[right]
}

function compareModes(left: GovernanceMode, right: GovernanceMode): number {
  if (left === right) {
    return 0
  }

  const ranking: Record<GovernanceMode, number> = {
    auto: 0,
    manual: 1,
    off: 2,
  }

  return ranking[left] - ranking[right]
}

function collectNormalizedTokens(skill: SkillRecord): string[] {
  const values = [
    skill.name,
    skill.description,
    skill.domain,
    skill.path,
    skill.entryFile,
    skill.fingerprints.nameNorm,
    ...skill.tags,
    ...(skill.projects ?? []),
  ]

  const tokens = new Set<string>()

  for (const value of values) {
    for (const token of tokenize(value)) {
      tokens.add(token)
    }
  }

  return [...tokens]
}

function matchesAny(values: readonly string[], markers: readonly string[]): boolean {
  return values.some((value) => {
    const normalized = normalizeToken(value)
    return markers.some((marker) => normalized.includes(marker))
  })
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

function clampPriority(priority: number): number {
  if (Number.isNaN(priority)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(priority)))
}
