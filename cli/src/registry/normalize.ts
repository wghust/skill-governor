// @ts-ignore - Node types are not wired into this repo yet.
import { createHash } from 'node:crypto'
// @ts-ignore - Node types are not wired into this repo yet.
import { basename, dirname, sep } from 'node:path'

import { createEmptyRegistry } from '../contracts.js'
import { getProviderAdapter } from '../providers/index.js'
import type { BuiltinProviderId } from '../providers/types.js'
import type {
  GovernanceMode,
  GovernanceScope,
  ProfileDocument,
  RegistryDocument,
  SkillRecord,
  SourceScope,
} from '../types.js'
import type { RegistryScanInput, SkillCandidate } from './scan.js'

export interface NormalizeRegistryInput {
  workspaceRoot: string
  candidates: readonly SkillCandidate[]
  providers?: readonly BuiltinProviderId[]
  sourceScopes?: readonly SourceScope[]
}

const DEFAULT_MODE: GovernanceMode = 'manual'
const DEFAULT_PRIORITY = 50
const DEFAULT_GOVERNANCE_SCOPE: GovernanceScope = 'workspace'
const DEFAULT_DOMAIN = 'general'

export async function normalizeSkillCandidate(
  candidate: SkillCandidate,
): Promise<SkillRecord> {
  const adapter = getProviderAdapter(candidate.provider)
  const partial = await adapter.parseSkill(candidate.entryFile)

  return normalizeSkillRecord(candidate, partial)
}

export async function normalizeRegistry(
  input: NormalizeRegistryInput,
): Promise<RegistryDocument> {
  const records = await Promise.all(
    input.candidates.map(async (candidate) => normalizeSkillCandidate(candidate)),
  )

  const registry = createEmptyRegistry(input.workspaceRoot)
  const providers = input.providers?.length
    ? [...new Set(input.providers)]
    : [...new Set(input.candidates.map((candidate) => candidate.provider))]
  const sourceScopes = resolveSourceScopes(input.sourceScopes, input.candidates)

  return {
    ...registry,
    providers,
    sources: {
      user: sourceScopes.includes('user'),
      workspace: sourceScopes.includes('workspace'),
    },
    skills: sortSkills(records),
  }
}

export async function scanAndNormalizeRegistry(
  input: RegistryScanInput,
): Promise<RegistryDocument> {
  const { scanSkillCandidates } = await import('./scan.js')
  const candidates = await scanSkillCandidates(input)

  return normalizeRegistry({
    workspaceRoot: input.workspaceRoot,
    candidates,
    providers: input.providers,
    sourceScopes: input.sourceScopes,
  })
}

export function normalizeSkillRecord(
  candidate: SkillCandidate,
  partial: Partial<SkillRecord>,
): SkillRecord {
  const inferredName = resolveName(candidate.entryFile, partial.name)
  const inferredDescription = resolveDescription(partial.description)
  const inferredDomain = resolveDomain(candidate.entryFile, partial.domain)
  const inferredTags = resolveTags({
    name: inferredName,
    description: inferredDescription,
    domain: inferredDomain,
    entryFile: candidate.entryFile,
    partialTags: partial.tags,
  })
  const path = partial.path?.trim() ? partial.path : dirname(candidate.entryFile)
  const metadata = partial.metadata ?? {
    parseWarnings: [],
    inferred: true,
    discoveredAt: new Date().toISOString(),
  }

  const hadMissingFields =
    !partial.name
    || !partial.description
    || !partial.domain
    || !partial.tags
    || !partial.path

  return {
    id: buildStableId(candidate),
    name: inferredName,
    description: inferredDescription,
    provider: candidate.provider,
    sourceScope: candidate.sourceScope,
    path,
    entryFile: candidate.entryFile,
    domain: inferredDomain,
    tags: inferredTags,
    projects: normalizeProjects(partial.projects),
    currentMode: partial.currentMode ?? DEFAULT_MODE,
    currentPriority: partial.currentPriority ?? DEFAULT_PRIORITY,
    currentGovernanceScope: partial.currentGovernanceScope ?? DEFAULT_GOVERNANCE_SCOPE,
    fingerprints: {
      nameNorm: normalizeName(inferredName),
      descHash: hashText(inferredDescription),
      tokenSet: buildTokenSet({
        name: inferredName,
        description: inferredDescription,
        domain: inferredDomain,
        tags: inferredTags,
        projects: normalizeProjects(partial.projects),
        path,
        entryFile: candidate.entryFile,
      }),
    },
    metadata: {
      parseWarnings: [...(metadata.parseWarnings ?? [])],
      inferred: Boolean(metadata.inferred || hadMissingFields),
      discoveredAt: metadata.discoveredAt ?? new Date().toISOString(),
    },
  }
}

function resolveSourceScopes(
  sourceScopes: readonly SourceScope[] | undefined,
  candidates: readonly SkillCandidate[],
): SourceScope[] {
  if (sourceScopes && sourceScopes.length > 0) {
    return [...new Set(sourceScopes)]
  }

  return [...new Set(candidates.map((candidate) => candidate.sourceScope))]
}

function sortSkills(skills: SkillRecord[]): SkillRecord[] {
  return [...skills].sort((left, right) => {
    const providerComparison = left.provider.localeCompare(right.provider)
    if (providerComparison !== 0) {
      return providerComparison
    }

    const sourceComparison = left.sourceScope.localeCompare(right.sourceScope)
    if (sourceComparison !== 0) {
      return sourceComparison
    }

    const pathComparison = left.path.localeCompare(right.path)
    if (pathComparison !== 0) {
      return pathComparison
    }

    return left.entryFile.localeCompare(right.entryFile)
  })
}

function buildStableId(candidate: SkillCandidate): string {
  const stableInput = [
    candidate.provider,
    candidate.sourceScope,
    candidate.entryFile,
  ].join('\u0000')

  return `skill:${candidate.provider}:${candidate.sourceScope}:${hashText(stableInput)}`
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function resolveName(entryFile: string, partialName: unknown): string {
  if (typeof partialName === 'string' && partialName.trim() !== '') {
    return partialName.trim()
  }

  const parentName = basename(dirname(entryFile))
  if (!isGenericName(parentName)) {
    return parentName
  }

  const grandParentName = basename(dirname(dirname(entryFile)))
  if (!isGenericName(grandParentName)) {
    return grandParentName
  }

  return basename(entryFile, '.md') || 'skill'
}

function resolveDescription(partialDescription: unknown): string {
  if (typeof partialDescription === 'string') {
    return partialDescription.trim()
  }

  return ''
}

function resolveDomain(entryFile: string, partialDomain: unknown): string {
  if (typeof partialDomain === 'string' && partialDomain.trim() !== '') {
    return partialDomain.trim()
  }

  const segments = entryFile.split(sep).filter((segment) => segment.length > 0)
  const skillIndex = segments.findIndex((segment) => segment === 'SKILL.md')
  const rootSegments = skillIndex >= 0 ? segments.slice(0, skillIndex) : segments.slice(0, -1)

  for (let index = rootSegments.length - 1; index >= 0; index -= 1) {
    const segment = rootSegments[index]
    if (isGenericName(segment)) {
      continue
    }

    const normalized = segment.toLowerCase()
    if (normalized === 'cursor' || normalized === 'codex' || normalized === 'claude') {
      continue
    }

    return segment
  }

  return DEFAULT_DOMAIN
}

function resolveTags(input: {
  name: string
  description: string
  domain: string
  entryFile: string
  partialTags: unknown
}): string[] {
  const tokens = new Set<string>()
  addTags(tokens, input.partialTags)

  if (input.domain !== DEFAULT_DOMAIN) {
    tokens.add(input.domain.toLowerCase())
  }

  for (const token of tokenizeText(input.name)) {
    tokens.add(token)
  }

  for (const token of tokenizeText(input.description)) {
    tokens.add(token)
  }

  for (const segment of input.entryFile.split(sep)) {
    const normalized = segment
      .replace(/\.md$/iu, '')
      .replace(/[^a-z0-9-]+/giu, '-')
      .toLowerCase()
      .replace(/^-+|-+$/gu, '')

    if (normalized.length > 0 && !isGenericName(normalized)) {
      tokens.add(normalized)
    }
  }

  return [...tokens].sort((left, right) => left.localeCompare(right))
}

function buildTokenSet(input: {
  name: string
  description: string
  domain: string
  tags: string[]
  projects?: string[]
  path: string
  entryFile: string
}): string[] {
  const tokens = new Set<string>()

  for (const token of resolveTags({
    name: input.name,
    description: input.description,
    domain: input.domain,
    entryFile: input.entryFile,
    partialTags: input.tags,
  })) {
    tokens.add(token)
  }

  if (input.projects) {
    for (const project of input.projects) {
      const normalized = project.trim().toLowerCase()
      if (normalized.length > 0) {
        tokens.add(normalized)
      }
    }
  }

  for (const segment of input.path.split(sep)) {
    const normalized = segment
      .replace(/\.md$/iu, '')
      .replace(/[^a-z0-9-]+/giu, '-')
      .toLowerCase()
      .replace(/^-+|-+$/gu, '')

    if (normalized.length > 0 && !isGenericName(normalized)) {
      tokens.add(normalized)
    }
  }

  return [...tokens].sort((left, right) => left.localeCompare(right))
}

function addTags(tokens: Set<string>, input: unknown): void {
  if (typeof input === 'string') {
    for (const token of input.split(/[\s,]+/u)) {
      const normalized = token.trim().toLowerCase()
      if (normalized.length > 0) {
        tokens.add(normalized)
      }
    }
    return
  }

  if (Array.isArray(input)) {
    for (const token of input) {
      if (typeof token !== 'string') {
        continue
      }

      const normalized = token.trim().toLowerCase()
      if (normalized.length > 0) {
        tokens.add(normalized)
      }
    }
  }
}

function tokenizeText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function normalizeProjects(projects: unknown): string[] | undefined {
  if (!Array.isArray(projects)) {
    return undefined
  }

  const values = projects
    .filter((project): project is string => typeof project === 'string')
    .map((project) => project.trim())
    .filter((project) => project.length > 0)

  return values.length > 0 ? values : undefined
}

function isGenericName(value: string): boolean {
  return value === ''
    || value === '.'
    || value.startsWith('.')
    || value === 'skills'
    || value === 'skill'
}
