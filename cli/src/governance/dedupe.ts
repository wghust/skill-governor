import type { SkillRecord } from '../types.js'

export interface DuplicateSuggestion {
  skill: SkillRecord
  score: number
  reasons: string[]
}

export interface DuplicateGroup {
  id: string
  key: string
  score: number
  primary: DuplicateSuggestion
  secondaries: DuplicateSuggestion[]
  reasons: string[]
}

export interface DedupeReport {
  threshold: number
  groups: DuplicateGroup[]
}

const DEFAULT_THRESHOLD = 0.66

export function findDuplicateGroups(
  skills: readonly SkillRecord[],
  threshold: number = DEFAULT_THRESHOLD,
): DedupeReport {
  const normalizedThreshold = clampThreshold(threshold)
  const parent = skills.map((_, index) => index)
  const pairScores = new Map<string, DuplicateComparison>()

  for (let leftIndex = 0; leftIndex < skills.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < skills.length; rightIndex += 1) {
      const comparison = compareDuplicateSkills(skills[leftIndex], skills[rightIndex])
      pairScores.set(buildPairKey(leftIndex, rightIndex), comparison)

      if (comparison.score >= normalizedThreshold) {
        union(parent, leftIndex, rightIndex)
      }
    }
  }

  const groupsByRoot = new Map<number, number[]>()
  skills.forEach((_, index) => {
    const root = find(parent, index)
    const members = groupsByRoot.get(root) ?? []
    members.push(index)
    groupsByRoot.set(root, members)
  })

  const groups = [...groupsByRoot.values()]
    .filter((members) => members.length > 1)
    .map((members) => buildDuplicateGroup(skills, members, pairScores))
    .sort((left, right) => {
      const keyComparison = left.key.localeCompare(right.key)
      if (keyComparison !== 0) {
        return keyComparison
      }

      return left.primary.skill.id.localeCompare(right.primary.skill.id)
    })

  return {
    threshold: normalizedThreshold,
    groups,
  }
}

interface DuplicateComparison {
  score: number
  reasons: string[]
}

function buildDuplicateGroup(
  skills: readonly SkillRecord[],
  memberIndexes: readonly number[],
  pairScores: Map<string, DuplicateComparison>,
): DuplicateGroup {
  const orderedMembers = [...memberIndexes].sort((left, right) => compareSkills(skills[left], skills[right]))
  const primaryIndex = orderedMembers[0]
  const primarySkill = skills[primaryIndex]
  const secondaryIndexes = orderedMembers.slice(1)

  const primary = createSuggestion(primarySkill, 1, collectReasons(primaryIndex, secondaryIndexes, pairScores))
  const secondaries = secondaryIndexes.map((index) => {
    const pairComparison = getBestPairComparison(primaryIndex, index, pairScores)
    return createSuggestion(skills[index], pairComparison.score, pairComparison.reasons)
  })

  const reasons = collectGroupReasons(memberIndexes, pairScores)
  const key = buildGroupKey(primarySkill, memberIndexes, skills, pairScores)
  const score = calculateGroupScore(memberIndexes, pairScores)

  return {
    id: `duplicate:${key}`,
    key,
    score,
    primary,
    secondaries,
    reasons,
  }
}

function createSuggestion(
  skill: SkillRecord,
  score: number,
  reasons: string[],
): DuplicateSuggestion {
  return {
    skill,
    score: roundScore(score),
    reasons: [...new Set(reasons)].sort((left, right) => left.localeCompare(right)),
  }
}

function compareDuplicateSkills(left: SkillRecord, right: SkillRecord): DuplicateComparison {
  if (left.fingerprints.nameNorm === right.fingerprints.nameNorm) {
    return {
      score: 1,
      reasons: ['normalized name equality'],
    }
  }

  const leftNameTokens = new Set(tokenize(left.fingerprints.nameNorm))
  const rightNameTokens = new Set(tokenize(right.fingerprints.nameNorm))
  const leftDescriptionTokens = new Set(tokenize(left.description))
  const rightDescriptionTokens = new Set(tokenize(right.description))
  const leftTagTokens = new Set(normalizeTokens(left.tags))
  const rightTagTokens = new Set(normalizeTokens(right.tags))
  const leftFingerprintTokens = new Set(normalizeTokens(left.fingerprints.tokenSet))
  const rightFingerprintTokens = new Set(normalizeTokens(right.fingerprints.tokenSet))

  const nameTokenOverlap = jaccard(leftNameTokens, rightNameTokens)
  const descriptionOverlap = jaccard(leftDescriptionTokens, rightDescriptionTokens)
  const tagOverlap = jaccard(leftTagTokens, rightTagTokens)
  const fingerprintOverlap = jaccard(leftFingerprintTokens, rightFingerprintTokens)
  const domainMatch = left.domain === right.domain && left.domain !== 'general'

  const score = Math.max(
    nameTokenOverlap * 0.7 + tagOverlap * 0.2 + (domainMatch ? 0.1 : 0),
    fingerprintOverlap * 0.55
      + tagOverlap * 0.25
      + descriptionOverlap * 0.15
      + (domainMatch ? 0.05 : 0),
  )

  const reasons = new Set<string>()
  if (nameTokenOverlap >= 0.5) {
    reasons.add('normalized name token overlap')
  }
  if (fingerprintOverlap >= 0.5) {
    reasons.add('fingerprint token overlap')
  }
  if (tagOverlap > 0) {
    reasons.add('tag overlap')
  }
  if (descriptionOverlap >= 0.4) {
    reasons.add('description overlap')
  }
  if (domainMatch) {
    reasons.add('domain overlap')
  }

  return {
    score,
    reasons: [...reasons],
  }
}

function buildGroupKey(
  primarySkill: SkillRecord,
  memberIndexes: readonly number[],
  skills: readonly SkillRecord[],
  pairScores: Map<string, DuplicateComparison>,
): string {
  const exactNameMatch = memberIndexes.every(
    (index) => skills[index].fingerprints.nameNorm === primarySkill.fingerprints.nameNorm,
  )

  if (exactNameMatch) {
    return `name:${primarySkill.fingerprints.nameNorm}`
  }

  const sharedTokens = intersectAll(memberIndexes.map((index) => skills[index].fingerprints.tokenSet))
  if (sharedTokens.length > 0) {
    return `tokens:${sharedTokens.slice(0, 4).join('+')}`
  }

  const sharedReasons = collectGroupReasons(memberIndexes, pairScores)
  return `shared:${normalizeKeyFragment(sharedReasons.join('+') || primarySkill.id)}`
}

function collectGroupReasons(
  memberIndexes: readonly number[],
  pairScores: Map<string, DuplicateComparison>,
): string[] {
  const reasons = new Set<string>()

  for (let left = 0; left < memberIndexes.length; left += 1) {
    for (let right = left + 1; right < memberIndexes.length; right += 1) {
      for (const reason of getBestPairComparison(memberIndexes[left], memberIndexes[right], pairScores).reasons) {
        reasons.add(reason)
      }
    }
  }

  return [...reasons].sort((left, right) => left.localeCompare(right))
}

function collectReasons(
  primaryIndex: number,
  secondaryIndexes: readonly number[],
  pairScores: Map<string, DuplicateComparison>,
): string[] {
  const reasons = new Set<string>()

  for (const secondaryIndex of secondaryIndexes) {
    const comparison = getBestPairComparison(primaryIndex, secondaryIndex, pairScores)
    for (const reason of comparison.reasons) {
      reasons.add(reason)
    }
  }

  return [...reasons]
}

function getBestPairComparison(
  leftIndex: number,
  rightIndex: number,
  pairScores: Map<string, DuplicateComparison>,
): DuplicateComparison {
  return pairScores.get(buildPairKey(leftIndex, rightIndex)) ?? {
    score: 0,
    reasons: [],
  }
}

function calculateGroupScore(
  memberIndexes: readonly number[],
  pairScores: Map<string, DuplicateComparison>,
): number {
  let score = 0
  let comparisons = 0

  for (let left = 0; left < memberIndexes.length; left += 1) {
    for (let right = left + 1; right < memberIndexes.length; right += 1) {
      score += getBestPairComparison(memberIndexes[left], memberIndexes[right], pairScores).score
      comparisons += 1
    }
  }

  return comparisons === 0 ? 0 : roundScore(score / comparisons)
}

function compareSkills(left: SkillRecord, right: SkillRecord): number {
  const sourceScopeRank = compareSourceScopes(left.sourceScope, right.sourceScope)
  if (sourceScopeRank !== 0) {
    return sourceScopeRank
  }

  const modeRank = compareModes(left.currentMode, right.currentMode)
  if (modeRank !== 0) {
    return modeRank
  }

  const priorityRank = right.currentPriority - left.currentPriority
  if (priorityRank !== 0) {
    return priorityRank
  }

  const warningRank = left.metadata.parseWarnings.length - right.metadata.parseWarnings.length
  if (warningRank !== 0) {
    return warningRank
  }

  const pathRank = left.path.localeCompare(right.path)
  if (pathRank !== 0) {
    return pathRank
  }

  return left.id.localeCompare(right.id)
}

function compareSourceScopes(left: SkillRecord['sourceScope'], right: SkillRecord['sourceScope']): number {
  if (left === right) {
    return 0
  }

  return left === 'workspace' ? -1 : 1
}

function compareModes(left: SkillRecord['currentMode'], right: SkillRecord['currentMode']): number {
  if (left === right) {
    return 0
  }

  const order = new Map<SkillRecord['currentMode'], number>([
    ['auto', 0],
    ['manual', 1],
    ['off', 2],
  ])

  return (order.get(left) ?? 99) - (order.get(right) ?? 99)
}

function buildPairKey(leftIndex: number, rightIndex: number): string {
  return `${Math.min(leftIndex, rightIndex)}:${Math.max(leftIndex, rightIndex)}`
}

function union(parent: number[], leftIndex: number, rightIndex: number): void {
  const leftRoot = find(parent, leftIndex)
  const rightRoot = find(parent, rightIndex)

  if (leftRoot !== rightRoot) {
    parent[rightRoot] = leftRoot
  }
}

function find(parent: number[], index: number): number {
  if (parent[index] !== index) {
    parent[index] = find(parent, parent[index])
  }

  return parent[index]
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function normalizeTokens(tokens: readonly string[]): string[] {
  const normalized = new Set<string>()

  for (const token of tokens) {
    const value = token
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')

    if (value.length > 0) {
      normalized.add(value)
    }
  }

  return [...normalized].sort((left, right) => left.localeCompare(right))
}

function intersectAll(tokenSets: readonly string[][]): string[] {
  if (tokenSets.length === 0) {
    return []
  }

  let shared = new Set(tokenSets[0])
  for (let index = 1; index < tokenSets.length; index += 1) {
    const next = new Set(tokenSets[index])
    shared = new Set([...shared].filter((token) => next.has(token)))
  }

  return [...shared].sort((left, right) => left.localeCompare(right))
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }

  const unionSize = new Set([...left, ...right]).size
  return unionSize === 0 ? 0 : intersection / unionSize
}

function normalizeKeyFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
}

function clampThreshold(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_THRESHOLD
  }

  return Math.min(1, Math.max(0, value))
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000
}
