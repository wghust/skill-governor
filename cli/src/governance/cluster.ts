import type { SkillRecord } from '../types.js'

export interface SkillCluster {
  domain: string
  keyword: string | null
  label: string
  skills: SkillRecord[]
}

export interface ClusterReport {
  clusters: SkillCluster[]
  domainCount: number
  keywordCount: number
}

const GENERIC_KEYWORDS = new Set([
  'skill',
  'skills',
  'guide',
  'playbook',
  'tool',
  'tools',
  'task',
  'tasks',
  'checklist',
  'workflow',
  'general',
  'misc',
  'other',
])

export function createSkillClusters(skills: readonly SkillRecord[]): ClusterReport {
  const clusters: SkillCluster[] = []
  const domains = groupByDomain(skills)

  for (const [domain, domainSkills] of domains) {
    const grouped = clusterDomainSkills(domain, domainSkills)
    clusters.push(...grouped)
  }

  clusters.sort((left, right) => {
    const domainComparison = left.domain.localeCompare(right.domain)
    if (domainComparison !== 0) {
      return domainComparison
    }

    const leftKeyword = left.keyword ?? ''
    const rightKeyword = right.keyword ?? ''
    const keywordComparison = leftKeyword.localeCompare(rightKeyword)
    if (keywordComparison !== 0) {
      return keywordComparison
    }

    return left.label.localeCompare(right.label)
  })

  return {
    clusters,
    domainCount: domains.size,
    keywordCount: clusters.filter((cluster) => cluster.keyword !== null).length,
  }
}

function groupByDomain(skills: readonly SkillRecord[]): Map<string, SkillRecord[]> {
  const grouped = new Map<string, SkillRecord[]>()

  for (const skill of skills) {
    const domain = normalizeDomain(skill.domain)
    const members = grouped.get(domain) ?? []
    members.push(skill)
    grouped.set(domain, members)
  }

  for (const members of grouped.values()) {
    members.sort(compareSkills)
  }

  return grouped
}

function clusterDomainSkills(domain: string, skills: readonly SkillRecord[]): SkillCluster[] {
  if (skills.length === 0) {
    return []
  }

  if (skills.length === 1) {
    return [createCluster(domain, null, skills)]
  }

  const keywordFrequencies = new Map<string, number>()
  const tokensBySkill = skills.map((skill) => getClusterTokens(skill, domain))

  for (const tokens of tokensBySkill) {
    for (const token of tokens) {
      keywordFrequencies.set(token, (keywordFrequencies.get(token) ?? 0) + 1)
    }
  }

  const usefulKeywords = [...keywordFrequencies.entries()]
    .filter(([token, count]) => count >= 2 && !GENERIC_KEYWORDS.has(token))
    .sort((left, right) => {
      const countComparison = right[1] - left[1]
      if (countComparison !== 0) {
        return countComparison
      }

      return left[0].localeCompare(right[0])
    })
    .map(([token]) => token)

  if (usefulKeywords.length === 0) {
    return [createCluster(domain, null, skills)]
  }

  const keywordBuckets = new Map<string, SkillRecord[]>()
  const fallback: SkillRecord[] = []

  for (let index = 0; index < skills.length; index += 1) {
    const skill = skills[index]
    const tokens = tokensBySkill[index]
    const matchedKeyword = usefulKeywords.find((keyword) => tokens.has(keyword))

    if (!matchedKeyword) {
      fallback.push(skill)
      continue
    }

    const bucket = keywordBuckets.get(matchedKeyword) ?? []
    bucket.push(skill)
    keywordBuckets.set(matchedKeyword, bucket)
  }

  const clusters: SkillCluster[] = []
  for (const keyword of usefulKeywords) {
    const bucket = keywordBuckets.get(keyword)
    if (!bucket || bucket.length === 0) {
      continue
    }

    clusters.push(createCluster(domain, keyword, bucket))
  }

  if (fallback.length > 0 || clusters.length === 0) {
    clusters.push(createCluster(domain, null, fallback.length > 0 ? fallback : skills))
  }

  return clusters
}

function createCluster(
  domain: string,
  keyword: string | null,
  skills: readonly SkillRecord[],
): SkillCluster {
  const label = keyword ? `${domain}/${keyword}` : domain
  return {
    domain,
    keyword,
    label,
    skills: [...skills].sort(compareSkills),
  }
}

function getClusterTokens(skill: SkillRecord, domain: string): Set<string> {
  const tokens = new Set<string>()
  const domainToken = normalizeToken(domain)

  for (const token of tokenize(skill.name)) {
    addToken(tokens, token, domainToken)
  }

  for (const token of skill.tags) {
    addToken(tokens, token, domainToken)
  }

  for (const token of tokenize(skill.description)) {
    addToken(tokens, token, domainToken)
  }

  return tokens
}

function addToken(tokens: Set<string>, token: string, domainToken: string): void {
  const normalized = normalizeToken(token)
  if (
    normalized.length === 0
    || normalized === domainToken
    || GENERIC_KEYWORDS.has(normalized)
  ) {
    return
  }

  tokens.add(normalized)
}

function compareSkills(left: SkillRecord, right: SkillRecord): number {
  const nameComparison = left.name.localeCompare(right.name)
  if (nameComparison !== 0) {
    return nameComparison
  }

  const sourceComparison = left.sourceScope.localeCompare(right.sourceScope)
  if (sourceComparison !== 0) {
    return sourceComparison
  }

  return left.id.localeCompare(right.id)
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

function normalizeDomain(value: string): string {
  const normalized = normalizeToken(value)
  return normalized.length > 0 ? normalized : 'general'
}
