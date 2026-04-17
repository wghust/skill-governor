import type {
  GovernanceMode,
  GovernancePlan,
  GovernanceScope,
  ProfileDocument,
  ProfileRuleMatch,
  Provider,
  ProviderRuntimeProjection,
  RegistryDocument,
  RuntimeProjectedSkill,
  RuntimeProjectionSet,
  SkillRecord,
  StateDocument,
} from '../types.js'
import { readGovernancePlan } from '../store/plans.js'
import { readProfileDocument } from '../store/profiles.js'
import { readRegistryDocument, readStateDocument } from '../store/state.js'
import { clearRuntimeProjectionSet, writeRuntimeProjectionSet } from '../store/runtime.js'
import { GovernanceWorkflowError } from '../apply.js'
import { classifySkill } from '../governance/policies.js'

interface RuntimeRoleContext {
  role: 'primary' | 'secondary' | 'normal'
  reasons: string[]
  target?: {
    mode: GovernanceMode
    priority: number
    governanceScope: GovernanceScope
  }
}

export interface RefreshRuntimeProjectionInput {
  storeRoot: string
  registry?: RegistryDocument
  state?: StateDocument | null
  generatedAt?: string
}

export async function refreshRuntimeProjections(
  input: RefreshRuntimeProjectionInput,
): Promise<RuntimeProjectionSet> {
  const registry = input.registry ?? await readRegistryDocument(input.storeRoot)
  if (registry === null) {
    throw new GovernanceWorkflowError(
      'REGISTRY_NOT_FOUND',
      `Registry was not found in ${input.storeRoot}`,
    )
  }

  const state = input.state ?? await readStateDocument(input.storeRoot)
  const projectionSet = await buildRuntimeProjectionSet({
    storeRoot: input.storeRoot,
    registry,
    state,
    generatedAt: input.generatedAt,
  })

  if (projectionSet.providers.length === 0 && projectionSet.activeProfile === null) {
    await clearRuntimeProjectionSet(input.storeRoot)
    return projectionSet
  }

  await writeRuntimeProjectionSet(input.storeRoot, projectionSet)
  return projectionSet
}

export interface BuildRuntimeProjectionSetInput {
  storeRoot: string
  registry: RegistryDocument
  state: StateDocument | null
  generatedAt?: string
}

export async function buildRuntimeProjectionSet(
  input: BuildRuntimeProjectionSetInput,
): Promise<RuntimeProjectionSet> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  if (input.state === null || input.state.activeProfile === null) {
    return {
      version: 1,
      generatedAt,
      activeProfile: null,
      planId: input.state?.lastAppliedPlanId ?? null,
      providers: [],
    }
  }

  const profile = await readProfileDocument(input.storeRoot, input.state.activeProfile)
  if (profile === null) {
    throw new GovernanceWorkflowError(
      'PROFILE_NOT_FOUND',
      `Profile '${input.state.activeProfile}' was not found in ${input.storeRoot}`,
    )
  }

  const plan = input.state.lastAppliedPlanId !== null
    ? await readGovernancePlan(input.storeRoot, input.state.lastAppliedPlanId)
    : null
  const roleMap = buildRoleMap(plan)
  const providers = resolveProviders(input.registry, input.state)
  const allowedSources = new Set(input.state.selectedSources)

  return {
    version: 1,
    generatedAt,
    activeProfile: profile.name,
    planId: input.state.lastAppliedPlanId,
    providers: providers.map((provider) => buildProviderProjection({
      provider,
      generatedAt,
      planId: input.state!.lastAppliedPlanId,
      activeProfile: profile.name,
      profile,
      skills: input.registry.skills.filter(
        (skill) => skill.provider === provider && allowedSources.has(skill.sourceScope),
      ),
      roleMap,
    })),
  }
}

interface ProviderProjectionInput {
  provider: Provider
  generatedAt: string
  activeProfile: string
  planId: string | null
  profile: ProfileDocument
  skills: SkillRecord[]
  roleMap: Map<string, RuntimeRoleContext>
}

function buildProviderProjection(input: ProviderProjectionInput): ProviderRuntimeProjection {
  const projected = input.skills
    .map((skill) => projectSkill(skill, input.profile, input.roleMap.get(skill.id)))
    .sort(compareProjectedSkills)

  return {
    version: 1,
    generatedAt: input.generatedAt,
    provider: input.provider,
    activeProfile: input.activeProfile,
    planId: input.planId,
    includedSkills: projected.filter((skill) => skill.included),
    excludedSkills: projected.filter((skill) => !skill.included),
  }
}

function projectSkill(
  skill: SkillRecord,
  profile: ProfileDocument,
  roleContext: RuntimeRoleContext | undefined,
): RuntimeProjectedSkill {
  const derivedTags = deriveTags(skill, roleContext)
  const resolved = {
    mode: profile.defaults.mode,
    priority: profile.defaults.priority,
    governanceScope: profile.defaults.governanceScope,
  }
  const reasons: string[] = [`active profile:${profile.name}`]

  for (const rule of profile.rules) {
    if (!matchesRule(rule.match, skill, derivedTags)) {
      continue
    }

    if (rule.set.mode !== undefined) {
      resolved.mode = rule.set.mode
    }

    if (rule.set.priority !== undefined) {
      resolved.priority = rule.set.priority
    }

    if (rule.set.governanceScope !== undefined) {
      resolved.governanceScope = rule.set.governanceScope
    }

    reasons.push(...(rule.reason ?? ['matched profile rule']))
  }

  if (roleContext?.target !== undefined) {
    resolved.mode = roleContext.target.mode
    resolved.priority = roleContext.target.priority
    resolved.governanceScope = roleContext.target.governanceScope
    reasons.push('resolved from applied plan action')
  }

  if (roleContext !== undefined) {
    reasons.push(...roleContext.reasons)
  }

  const included = resolved.mode !== 'off'
  reasons.push(included ? 'included in runtime projection' : 'excluded by resolved mode:off')

  return {
    skillId: skill.id,
    name: skill.name,
    provider: skill.provider,
    sourceScope: skill.sourceScope,
    path: skill.path,
    entryFile: skill.entryFile,
    domain: skill.domain,
    derivedTags,
    resolvedMode: resolved.mode,
    resolvedPriority: resolved.priority,
    resolvedGovernanceScope: resolved.governanceScope,
    included,
    reasons: [...new Set(reasons)],
  }
}

function deriveTags(skill: SkillRecord, roleContext: RuntimeRoleContext | undefined): string[] {
  const tags = new Set<string>(skill.tags)
  tags.add(classifySkill(skill))

  if (roleContext?.role === 'primary') {
    tags.add('duplicate-primary')
  }

  if (roleContext?.role === 'secondary') {
    tags.add('duplicate-secondary')
  }

  return [...tags].sort((left, right) => left.localeCompare(right))
}

function matchesRule(
  match: ProfileRuleMatch,
  skill: SkillRecord,
  derivedTags: readonly string[],
): boolean {
  if (match.provider !== undefined && !match.provider.includes(skill.provider)) {
    return false
  }

  if (match.sourceScope !== undefined && !match.sourceScope.includes(skill.sourceScope)) {
    return false
  }

  if (match.domain !== undefined && !match.domain.includes(skill.domain)) {
    return false
  }

  if (match.tags !== undefined) {
    const tagSet = new Set(derivedTags)
    if (!match.tags.every((tag) => tagSet.has(tag))) {
      return false
    }
  }

  if (match.projects !== undefined) {
    const projects = new Set(skill.projects ?? [])
    if (!match.projects.every((project) => projects.has(project))) {
      return false
    }
  }

  return true
}

function buildRoleMap(plan: GovernancePlan | null): Map<string, RuntimeRoleContext> {
  const roleMap = new Map<string, RuntimeRoleContext>()

  for (const action of plan?.actions ?? []) {
    const normalizedReasons = action.reason.map((reason) => reason.toLowerCase())
    const role = normalizedReasons.some((reason) => reason.includes('duplicate primary selected'))
      ? 'primary'
      : normalizedReasons.some((reason) => reason.includes('duplicate secondary demoted'))
        ? 'secondary'
        : 'normal'

    roleMap.set(action.skillId, {
      role,
      reasons: [...action.reason],
      target: {
        mode: action.after.mode,
        priority: action.after.priority,
        governanceScope: action.after.governanceScope,
      },
    })
  }

  return roleMap
}

function resolveProviders(registry: RegistryDocument, state: StateDocument): Provider[] {
  const selected = state.selectedProviders.length > 0
    ? state.selectedProviders
    : registry.providers

  return [...new Set(selected)].sort((left, right) => left.localeCompare(right))
}

function compareProjectedSkills(left: RuntimeProjectedSkill, right: RuntimeProjectedSkill): number {
  const includeRank = Number(right.included) - Number(left.included)
  if (includeRank !== 0) {
    return includeRank
  }

  const modeRank = compareModes(left.resolvedMode, right.resolvedMode)
  if (modeRank !== 0) {
    return modeRank
  }

  const priorityRank = right.resolvedPriority - left.resolvedPriority
  if (priorityRank !== 0) {
    return priorityRank
  }

  return left.name.localeCompare(right.name) || left.skillId.localeCompare(right.skillId)
}

function compareModes(left: GovernanceMode, right: GovernanceMode): number {
  const order: Record<GovernanceMode, number> = {
    auto: 0,
    manual: 1,
    off: 2,
  }

  return order[left] - order[right]
}
