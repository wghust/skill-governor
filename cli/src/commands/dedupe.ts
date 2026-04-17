import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import { findDuplicateGroups } from '../governance/dedupe.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { RegistrySelectionOptions } from '../cli.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
} from '../cli.js'

type DedupeCommandOptions = RegistrySelectionOptions & {
  threshold?: string | number
}

export function registerDedupeCommand(program: Command): Command {
  const command = program
    .command('dedupe')
    .description('Find duplicate skills')
    .option('--threshold <number>', 'duplicate similarity threshold', '0.8')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: DedupeCommandOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const threshold = Number.parseFloat(String(options.threshold ?? '0.8'))
      const report = findDuplicateGroups(registry.skills, threshold)

      emitResult(success(report), resolveFormat(options.format), renderDedupeText)
    } catch (error) {
      emitResult(
        failure('DEDUPE_FAILED', error instanceof Error ? error.message : 'Failed to dedupe skills'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderDedupeText(result: { ok: true; data: { threshold: number; groups: Array<{ id: string; key: string; score: number; primary: { skill: { name: string; id: string } }; secondaries: Array<{ skill: { name: string; id: string } }> }> } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Threshold: ${result.data.threshold}`,
    `Duplicate groups: ${result.data.groups.length}`,
    ...result.data.groups.map((group) => {
      const secondaryIds = group.secondaries.map((item) => item.skill.id).join(', ')
      return `${group.key}: primary=${group.primary.skill.id}; secondaries=${secondaryIds || 'none'}`
    }),
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}
