import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { RegistrySelectionOptions } from '../cli.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
} from '../cli.js'

export function registerInspectCommand(program: Command): Command {
  const command = program
    .command('inspect')
    .description('Inspect a normalized skill by id, path, or name')
    .argument('<query>', 'skill id, path, or name to inspect')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (query: string, options: RegistrySelectionOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const skill = findSkill(registry.skills, query)

      if (!skill) {
        emitResult(
          failure('SKILL_NOT_FOUND', `No skill matched "${query}"`, { query }),
          resolveFormat(options.format),
          renderFailureText,
        )
        return
      }

      emitResult(
        success({ query, skill }),
        resolveFormat(options.format),
        renderInspectText,
      )
    } catch (error) {
      emitResult(
        failure('INSPECT_FAILED', error instanceof Error ? error.message : 'Failed to inspect skill'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function findSkill(skills: readonly { id: string; name: string; path: string; entryFile: string; fingerprints: { nameNorm: string } }[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return skills.find((skill) => {
    return [
      skill.id,
      skill.name,
      skill.path,
      skill.entryFile,
      skill.fingerprints.nameNorm,
    ].some((value) => value.trim().toLowerCase() === normalizedQuery)
  }) ?? null
}

function renderInspectText(result: { ok: true; data: { query: string; skill: { id: string; name: string; path: string; provider: string; sourceScope: string; domain: string } } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  const { skill } = result.data
  return [
    `Query: ${result.data.query}`,
    `Skill: ${skill.name} (${skill.id})`,
    `Provider: ${skill.provider}`,
    `Source scope: ${skill.sourceScope}`,
    `Domain: ${skill.domain}`,
    `Path: ${skill.path}`,
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}
