import type {
  GovernancePlan,
  GovernancePolicy,
  RegistryDocument,
  SkillAction,
  SkillRecord,
} from '../types.js'
import type { DuplicateGroup } from './dedupe.js'
import { findDuplicateGroups } from './dedupe.js'
import {
  buildProfileDraft,
  buildTargetSide,
  classifySkill,
  getPolicyConfig,
  selectPrimarySkill,
} from './policies.js'

type DuplicateRole = 'primary' | 'secondary' | 'normal'

interface DuplicateMembership {
  groupId: string
  key: string
  role: DuplicateRole
}

export function createGovernancePlan(
  registry: RegistryDocument,
  policy: GovernancePolicy = 'balanced',
): GovernancePlan {
  const config = getPolicyConfig(policy)
  const duplicateReport = findDuplicateGroups(registry.skills, config.duplicateThreshold)
  const duplicateMembership = buildDuplicateMemberships(duplicateReport.groups, policy)
  const actions = buildActions(registry.skills, policy, duplicateMembership)
  const profileDraft = buildProfileDraft(policy, registry.skills, duplicateReport.groups)
  const warnings = buildWarnings(registry, policy, duplicateReport.groups, actions)

  return {
    version: 1,
    id: buildPlanId(policy),
    createdAt: new Date().toISOString(),
    policy,
    summary: {
      totalSkills: registry.skills.length,
      changedSkills: actions.length,
      duplicateGroups: duplicateReport.groups.length,
      suggestedProfiles: [profileDraft.name],
    },
    actions,
    profileDrafts: [profileDraft],
    warnings,
  }
}

function buildActions(
  skills: readonly SkillRecord[],
  policy: GovernancePolicy,
  duplicateMembership: Map<string, DuplicateMembership>,
): SkillAction[] {
  const actions: SkillAction[] = []

  for (const skill of skills) {
    const duplicate = duplicateMembership.get(skill.id)
    const role: DuplicateRole = duplicate?.role ?? 'normal'
    const target = buildTargetSide(skill, policy, role)
    const before = {
      mode: skill.currentMode,
      priority: skill.currentPriority,
      governanceScope: skill.currentGovernanceScope,
    }

    if (!hasStateChanged(before, target)) {
      continue
    }

    const reasons = buildReasons(skill, policy, role, duplicate?.key ?? null)

    actions.push({
      skillId: skill.id,
      provider: skill.provider,
      path: skill.path,
      before,
      after: target,
      reason: reasons,
    })
  }

  return actions.sort(compareActions)
}

function buildDuplicateMemberships(
  groups: readonly DuplicateGroup[],
  policy: GovernancePolicy,
): Map<string, DuplicateMembership> {
  const memberships = new Map<string, DuplicateMembership>()

  for (const group of groups) {
    const members = [group.primary.skill, ...group.secondaries.map((item) => item.skill)]
    const primary = selectPrimarySkill(members, policy)

    for (const skill of members) {
      memberships.set(skill.id, {
        groupId: group.id,
        key: group.key,
        role: skill.id === primary.id ? 'primary' : 'secondary',
      })
    }
  }

  return memberships
}

function buildWarnings(
  registry: RegistryDocument,
  policy: GovernancePolicy,
  duplicateGroups: readonly DuplicateGroup[],
  actions: readonly SkillAction[],
): string[] {
  const warnings: string[] = []

  if (duplicateGroups.length > 0) {
    warnings.push(
      `Detected ${duplicateGroups.length} duplicate group(s) using ${policy} policy threshold.`,
    )
  }

  if (registry.skills.some((skill) => skill.sourceScope === 'workspace')) {
    warnings.push('Workspace skills are prioritized above user skills when duplicates are resolved.')
  }

  if (actions.length === 0) {
    warnings.push('No governance changes were required for the selected policy.')
  }

  return warnings
}

function buildReasons(
  skill: SkillRecord,
  policy: GovernancePolicy,
  role: DuplicateRole,
  duplicateKey: string | null,
): string[] {
  const reasons = [
    `policy:${policy}`,
    `tier:${classifySkill(skill)}`,
  ]

  if (skill.sourceScope === 'workspace') {
    reasons.push('sourceScope:workspace')
  } else {
    reasons.push('sourceScope:user')
  }

  if (role === 'primary') {
    reasons.push('duplicate primary selected')
  }

  if (role === 'secondary') {
    reasons.push('duplicate secondary demoted')
  }

  if (duplicateKey !== null) {
    reasons.push(`duplicate group:${duplicateKey}`)
  }

  return [...new Set(reasons)].sort((left, right) => left.localeCompare(right))
}

function compareActions(left: SkillAction, right: SkillAction): number {
  const roleRank = getActionRank(left) - getActionRank(right)
  if (roleRank !== 0) {
    return roleRank
  }

  const modeRank = compareModes(left.after.mode, right.after.mode)
  if (modeRank !== 0) {
    return modeRank
  }

  const priorityRank = right.after.priority - left.after.priority
  if (priorityRank !== 0) {
    return priorityRank
  }

  const pathRank = left.path.localeCompare(right.path)
  if (pathRank !== 0) {
    return pathRank
  }

  return left.skillId.localeCompare(right.skillId)
}

function getActionRank(action: SkillAction): number {
  const reasons = action.reason.join(' ').toLowerCase()
  if (reasons.includes('duplicate secondary')) {
    return 0
  }

  if (reasons.includes('duplicate primary')) {
    return 1
  }

  return 2
}

function compareModes(left: SkillAction['after']['mode'], right: SkillAction['after']['mode']): number {
  if (left === right) {
    return 0
  }

  const ranking: Record<SkillAction['after']['mode'], number> = {
    auto: 0,
    manual: 1,
    off: 2,
  }

  return ranking[right] - ranking[left]
}

function hasStateChanged(
  before: SkillAction['before'],
  after: SkillAction['after'],
): boolean {
  return (
    before.mode !== after.mode
    || before.priority !== after.priority
    || before.governanceScope !== after.governanceScope
  )
}

function buildPlanId(policy: GovernancePolicy): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, '')
  return `plan_${policy}_${stamp}`
}
