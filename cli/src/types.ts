export type Provider = 'cursor' | 'codex' | 'claude' | 'custom'

export type SourceScope = 'user' | 'workspace'

export type GovernanceMode = 'auto' | 'manual' | 'off'

export type GovernanceScope = 'global' | 'workspace' | 'session' | 'task'

export interface SkillFingerprint {
  nameNorm: string
  descHash: string
  tokenSet: string[]
}

export interface SkillMetadata {
  parseWarnings: string[]
  inferred: boolean
  discoveredAt: string
}

export interface SkillRecord {
  id: string
  name: string
  description: string
  provider: Provider
  sourceScope: SourceScope
  path: string
  entryFile: string
  domain: string
  tags: string[]
  projects?: string[]
  currentMode: GovernanceMode
  currentPriority: number
  currentGovernanceScope: GovernanceScope
  fingerprints: SkillFingerprint
  metadata: SkillMetadata
}

export interface RegistrySources {
  user: boolean
  workspace: boolean
}

export interface RegistryDocument {
  version: 1
  generatedAt: string
  workspaceRoot: string
  sources: RegistrySources
  providers: Provider[]
  skills: SkillRecord[]
}

export interface SkillActionSide {
  mode: GovernanceMode
  priority: number
  governanceScope: GovernanceScope
}

export interface SkillAction {
  skillId: string
  provider: Provider
  path: string
  before: SkillActionSide
  after: SkillActionSide
  reason: string[]
}

export interface GovernancePlanSummary {
  totalSkills: number
  changedSkills: number
  duplicateGroups: number
  suggestedProfiles: string[]
}

export type GovernancePolicy = 'conservative' | 'balanced' | 'aggressive'

export interface ProfileDefaults {
  mode: GovernanceMode
  priority: number
  governanceScope: GovernanceScope
}

export interface ProfileRuleMatch {
  provider?: Provider[]
  sourceScope?: SourceScope[]
  domain?: string[]
  tags?: string[]
  projects?: string[]
}

export interface ProfileRuleSet {
  mode?: GovernanceMode
  priority?: number
  governanceScope?: GovernanceScope
}

export interface ProfileRule {
  match: ProfileRuleMatch
  set: ProfileRuleSet
  reason?: string[]
}

export interface ProfileDocument {
  version: 1
  name: string
  description: string
  defaults: ProfileDefaults
  rules: ProfileRule[]
}

export interface GovernancePlan {
  version: 1
  id: string
  createdAt: string
  policy: GovernancePolicy
  summary: GovernancePlanSummary
  actions: SkillAction[]
  profileDrafts: ProfileDocument[]
  warnings: string[]
}

export interface StateDocument {
  version: 1
  activeProfile: string | null
  lastAppliedPlanId: string | null
  selectedSources: SourceScope[]
  selectedProviders: Provider[]
  updatedAt: string
}

export interface SnapshotDocument {
  version: 1
  snapshotId: string
  createdAt: string
  previousState: StateDocument | null
  previousProfiles: ProfileDocument[]
  basedOnPlanId: string | null
}

export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[]

export interface CliSuccess<T> {
  ok: true
  data: T
}

export interface CliError {
  ok: false
  error: {
    code: string
    message: string
    details?: JsonValue
  }
}

export type CliResult<T> = CliSuccess<T> | CliError
