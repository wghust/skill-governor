// @ts-ignore - Node types are not wired into this repo yet.
import { readdir, readFile } from 'node:fs/promises'
// @ts-ignore - Node types are not wired into this repo yet.
import { basename, dirname, join, normalize, sep } from 'node:path'

import type { Provider, SkillRecord } from '../types.js'

export const BUILTIN_PROVIDER_IDS = ['cursor', 'codex', 'claude'] as const satisfies readonly Provider[]

export type BuiltinProviderId = (typeof BUILTIN_PROVIDER_IDS)[number]

export interface ProviderAdapter {
  provider: BuiltinProviderId
  getDefaultUserRoots(homeDir: string): string[]
  getDefaultWorkspaceRoots(workspaceRoot: string): string[]
  findSkillEntryCandidates(root: string): Promise<string[]>
  parseSkill(entryFile: string): Promise<Partial<SkillRecord>>
}

interface ProviderDefinition {
  provider: BuiltinProviderId
  userRoots(homeDir: string): string[]
  workspaceRoots(workspaceRoot: string): string[]
}

const SKILL_ENTRY_FILE = 'SKILL.md'
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git'])
const PROVIDER_DIR_NAMES = new Set(['cursor', 'codex', 'claude'])
const GENERIC_SKILL_ROOT_NAMES = new Set(['skills', 'skill'])
const DEFAULT_DOMAIN = 'general'

export function createProviderAdapter(
  definition: ProviderDefinition,
): ProviderAdapter {
  return {
    provider: definition.provider,
    getDefaultUserRoots(homeDir: string): string[] {
      return [...definition.userRoots(homeDir)]
    },
    getDefaultWorkspaceRoots(workspaceRoot: string): string[] {
      return [...definition.workspaceRoots(workspaceRoot)]
    },
    findSkillEntryCandidates(root: string): Promise<string[]> {
      return findSkillEntryCandidates(root)
    },
    parseSkill(entryFile: string): Promise<Partial<SkillRecord>> {
      return parseSkill(entryFile, definition.provider)
    },
  }
}

export async function findSkillEntryCandidates(root: string): Promise<string[]> {
  const candidates: string[] = []

  async function visit(currentRoot: string): Promise<void> {
    let entries
    try {
      entries = await readdir(currentRoot, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }

      const fullPath = join(currentRoot, entry.name)
      if (entry.isDirectory()) {
        await visit(fullPath)
        continue
      }

      if (entry.isFile() && entry.name === SKILL_ENTRY_FILE) {
        candidates.push(fullPath)
      }
    }
  }

  await visit(root)
  candidates.sort((left, right) => left.localeCompare(right))
  return candidates
}

async function parseSkill(
  entryFile: string,
  provider: BuiltinProviderId,
): Promise<Partial<SkillRecord>> {
  const raw = await readFile(entryFile, 'utf8')
  const { frontmatter, body, warnings } = parseFrontmatter(raw)

  const inferredName = inferName(entryFile, frontmatter.name, body)
  const inferredDescription = inferDescription(frontmatter.description, body)
  const inferredDomain = inferDomain(entryFile, frontmatter.domain)
  const inferredTags = inferTags({
    frontmatterTags: frontmatter.tags,
    domain: inferredDomain,
    entryFile,
    name: inferredName,
    description: inferredDescription,
  })

  const inferred = Boolean(
    frontmatter.name === undefined
      || frontmatter.description === undefined
      || frontmatter.domain === undefined
      || frontmatter.tags === undefined,
  )

  return {
    provider,
    entryFile,
    path: dirname(entryFile),
    name: inferredName,
    description: inferredDescription,
    domain: inferredDomain,
    tags: inferredTags,
    metadata: {
      parseWarnings: warnings,
      inferred,
      discoveredAt: new Date().toISOString(),
    },
  }
}

interface Frontmatter {
  name?: string
  description?: string
  domain?: string
  tags?: string[]
  projects?: string[]
}

interface ParsedFrontmatter {
  frontmatter: Frontmatter
  body: string
  warnings: string[]
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const warnings: string[] = []
  const frontmatter: Record<string, string | string[] | undefined> = {}

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u)
  if (!match) {
    return {
      frontmatter,
      body: raw,
      warnings,
    }
  }

  const lines = match[1].split(/\r?\n/u)
  let currentListKey: string | null = null

  for (const line of lines) {
    if (line.trim() === '') {
      continue
    }

    const listItemMatch = line.match(/^\s*-\s*(.+)$/u)
    if (currentListKey && listItemMatch) {
      const value = listItemMatch[1].trim()
      const existing = frontmatter[currentListKey]
      if (Array.isArray(existing)) {
        existing.push(stripQuotes(value))
      }
      continue
    }

    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/u)
    if (!keyValueMatch) {
      warnings.push(`Unparsed frontmatter line: ${line}`)
      currentListKey = null
      continue
    }

    const key = keyValueMatch[1]
    const value = keyValueMatch[2].trim()

    if (value === '') {
      frontmatter[key] = []
      currentListKey = key
      continue
    }

    const parsedValue = parseFrontmatterValue(value)
    if (Array.isArray(parsedValue)) {
      frontmatter[key] = parsedValue
      currentListKey = key
      continue
    }

    frontmatter[key] = parsedValue
    currentListKey = null
  }

  return {
    frontmatter: frontmatter as Frontmatter,
    body: raw.slice(match[0].length),
    warnings,
  }
}

function parseFrontmatterValue(value: string): string | string[] {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (inner === '') {
      return []
    }

    return inner
      .split(',')
      .map((token) => stripQuotes(token.trim()))
      .filter((token) => token.length > 0)
  }

  if (value.includes(',')) {
    return value
      .split(',')
      .map((token) => stripQuotes(token.trim()))
      .filter((token) => token.length > 0)
  }

  return stripQuotes(value)
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function inferName(entryFile: string, frontmatterName: unknown, body: string): string {
  if (typeof frontmatterName === 'string' && frontmatterName.trim() !== '') {
    return frontmatterName.trim()
  }

  const titleLine = body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))

  if (titleLine) {
    return titleLine.slice(2).trim()
  }

  const parentName = basename(dirname(entryFile))
  if (!isGenericDirectoryName(parentName)) {
    return parentName
  }

  const grandParentName = basename(dirname(dirname(entryFile)))
  if (!isGenericDirectoryName(grandParentName)) {
    return grandParentName
  }

  return basename(entryFile, '.md') || 'skill'
}

function inferDescription(frontmatterDescription: unknown, body: string): string {
  if (typeof frontmatterDescription === 'string' && frontmatterDescription.trim() !== '') {
    return frontmatterDescription.trim()
  }

  const lines = body.split(/\r?\n/u)
  let sawHeading = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (sawHeading) {
        break
      }
      continue
    }

    if (trimmed.startsWith('# ')) {
      sawHeading = true
      continue
    }

    return trimmed
  }

  return ''
}

function inferDomain(entryFile: string, frontmatterDomain: unknown): string {
  if (typeof frontmatterDomain === 'string' && frontmatterDomain.trim() !== '') {
    return frontmatterDomain.trim()
  }

  const segments = normalize(entryFile)
    .split(sep)
    .filter((segment: string) => segment.length > 0)
  const skillIndex = segments.findIndex((segment: string) => segment === SKILL_ENTRY_FILE)
  const rootSegments = skillIndex >= 0 ? segments.slice(0, skillIndex) : segments.slice(0, -1)

  for (let index = rootSegments.length - 1; index >= 0; index -= 1) {
    const segment = rootSegments[index]
    if (isGenericDirectoryName(segment)) {
      continue
    }
    if (PROVIDER_DIR_NAMES.has(segment.toLowerCase())) {
      continue
    }
    return segment
  }

  return DEFAULT_DOMAIN
}

interface InferTagsInput {
  frontmatterTags: unknown
  domain: string
  entryFile: string
  name: string
  description: string
}

function inferTags({
  frontmatterTags,
  domain,
  entryFile,
  name,
  description,
}: InferTagsInput): string[] {
  const tokens = new Set<string>()

  collectTags(tokens, frontmatterTags)
  if (domain !== DEFAULT_DOMAIN) {
    tokens.add(domain)
  }

  const pathSegments = normalize(entryFile).split(sep)
  for (const segment of pathSegments) {
    if (isGenericDirectoryName(segment) || PROVIDER_DIR_NAMES.has(segment.toLowerCase())) {
      continue
    }

    const normalizedSegment = segment
      .replace(/\.md$/iu, '')
      .replace(/[^a-z0-9-]+/giu, '-')
      .toLowerCase()
      .replace(/^-+|-+$/gu, '')

    if (normalizedSegment.length > 0 && normalizedSegment !== 'skill') {
      tokens.add(normalizedSegment)
    }
  }

  for (const token of tokenizeText(name)) {
    tokens.add(token)
  }

  for (const token of tokenizeText(description)) {
    tokens.add(token)
  }

  return [...tokens].sort((left, right) => left.localeCompare(right))
}

function collectTags(tokens: Set<string>, input: unknown): void {
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
    for (const item of input) {
      if (typeof item !== 'string') {
        continue
      }

      const normalized = item.trim().toLowerCase()
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

function isGenericDirectoryName(value: string): boolean {
  return GENERIC_SKILL_ROOT_NAMES.has(value.toLowerCase()) || value.startsWith('.')
}
