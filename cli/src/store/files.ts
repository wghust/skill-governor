// @ts-ignore - Node types are not wired into this repo yet.
import { mkdir, readFile, rename, writeFile, rm } from 'node:fs/promises'
// @ts-ignore - Node types are not wired into this repo yet.
import { basename, dirname, join } from 'node:path'

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === 'ENOENT',
  )
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

async function atomicWriteTextFile(filePath: string, contents: string): Promise<void> {
  await ensureParentDirectory(filePath)

  const tempFilePath = join(
    dirname(filePath),
    `.${basename(filePath)}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`,
  )

  await writeFile(tempFilePath, contents, 'utf8')

  try {
    await rename(tempFilePath, filePath)
  } catch (error) {
    await rm(tempFilePath, { force: true })
    throw error
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const contents = await readFile(filePath, 'utf8')
    if (contents.trim() === '') {
      return null
    }

    return JSON.parse(contents) as T
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }

    throw error
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const contents = `${JSON.stringify(value, null, 2)}\n`
  await atomicWriteTextFile(filePath, contents)
}

export async function readYamlFile<T>(filePath: string): Promise<T | null> {
  try {
    const contents = await readFile(filePath, 'utf8')
    if (contents.trim() === '') {
      return null
    }

    return parseYamlDocument(contents) as T
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }

    const contents = await readFile(filePath, 'utf8')
    try {
      return JSON.parse(contents) as T
    } catch {
      throw error
    }
  }
}

export async function writeYamlFile(filePath: string, value: unknown): Promise<void> {
  const contents = `${serializeYamlDocument(value)}\n`
  await atomicWriteTextFile(filePath, contents)
}

function serializeYamlDocument(value: unknown): string {
  return serializeYamlNode(value, 0).join('\n')
}

function serializeYamlNode(value: unknown, indent: number): string[] {
  const prefix = ' '.repeat(indent)

  if (value === null) {
    return [`${prefix}null`]
  }

  if (typeof value === 'string') {
    return [`${prefix}${formatYamlScalar(value)}`]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [`${prefix}${String(value)}`]
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${prefix}[]`]
    }

    const lines: string[] = []
    for (const item of value) {
      if (isYamlScalar(item)) {
        lines.push(`${prefix}- ${formatYamlScalar(item)}`)
        continue
      }

      lines.push(`${prefix}-`)
      lines.push(...serializeYamlNode(item, indent + 2))
    }
    return lines
  }

  if (isPlainObject(value)) {
    const lines: string[] = []
    for (const [key, entryValue] of Object.entries(value)) {
      if (isYamlScalar(entryValue)) {
        lines.push(`${prefix}${key}: ${formatYamlScalar(entryValue)}`)
        continue
      }

      if (Array.isArray(entryValue) && entryValue.length === 0) {
        lines.push(`${prefix}${key}: []`)
        continue
      }

      lines.push(`${prefix}${key}:`)
      lines.push(...serializeYamlNode(entryValue, indent + 2))
    }
    return lines
  }

  return [`${prefix}${formatYamlScalar(String(value))}`]
}

function parseYamlDocument(contents: string): unknown {
  const lines = contents.split(/\r?\n/u)
  let cursor = 0

  return parseBlock(0)

  function parseBlock(expectedIndent: number): unknown {
    const next = peekMeaningfulLine()
    if (!next) {
      return null
    }

    if (next.indent < expectedIndent) {
      return null
    }

    return next.text.startsWith('-')
      ? parseArray(next.indent)
      : parseObject(next.indent)
  }

  function parseObject(expectedIndent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    while (true) {
      const next = peekMeaningfulLine()
      if (!next || next.indent < expectedIndent || next.indent > expectedIndent) {
        break
      }

      if (next.text.startsWith('-')) {
        break
      }

      cursor = next.index + 1

      const colonIndex = next.text.indexOf(':')
      if (colonIndex < 0) {
        throw new Error(`Invalid YAML mapping line: ${next.text}`)
      }

      const key = next.text.slice(0, colonIndex).trim()
      const rawValue = next.text.slice(colonIndex + 1).trimStart()

      if (rawValue.length > 0) {
        result[key] = rawValue === '[]' ? [] : parseYamlScalar(rawValue)
        continue
      }

      const child = parseBlock(next.indent + 2)
      result[key] = child
    }

    return result
  }

  function parseArray(expectedIndent: number): unknown[] {
    const result: unknown[] = []

    while (true) {
      const next = peekMeaningfulLine()
      if (!next || next.indent < expectedIndent || next.indent > expectedIndent) {
        break
      }

      if (!next.text.startsWith('-')) {
        break
      }

      cursor = next.index + 1
      const rawValue = next.text.slice(1).trimStart()
      if (rawValue.length > 0) {
        result.push(rawValue === '[]' ? [] : parseYamlScalar(rawValue))
        continue
      }

      result.push(parseBlock(next.indent + 2))
    }

    return result
  }

  function peekMeaningfulLine(): { index: number; indent: number; text: string } | null {
    while (cursor < lines.length) {
      const rawLine = lines[cursor]
      if (rawLine.trim() === '') {
        cursor += 1
        continue
      }

      const indent = rawLine.match(/^\s*/u)?.[0].length ?? 0
      return {
        index: cursor,
        indent,
        text: rawLine.slice(indent),
      }
    }

    return null
  }
}

function parseYamlScalar(value: string): unknown {
  if (value === 'null' || value === '~') {
    return null
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  if (/^-?\d+(?:\.\d+)?$/u.test(value)) {
    return Number(value)
  }

  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return unquoteYamlScalar(value)
  }

  return value
}

function formatYamlScalar(value: string | number | boolean | null): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (value === '') {
    return "''"
  }

  if (/^[A-Za-z0-9_.-]+$/u.test(value)) {
    return value
  }

  return `'${value.replace(/'/gu, "''")}'`
}

function unquoteYamlScalar(value: string): string {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/gu, "'")
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/gu, '"').replace(/\\\\/gu, '\\')
  }

  return value
}

function isYamlScalar(value: unknown): value is string | number | boolean | null {
  return (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
  )
}
