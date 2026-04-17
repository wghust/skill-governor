import type { Command } from 'commander'

import { success, failure } from '../contracts.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { RegistryDocument } from '../types.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
  type RegistrySelectionOptions,
} from '../cli.js'

type CliTextResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export function registerListCommand(program: Command): Command {
  const command = program
    .command('list')
    .description('List normalized skills')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: RegistrySelectionOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      emitResult(success(registry), resolveFormat(options.format), renderRegistryText)
    } catch (error) {
      emitResult(
        failure('LIST_FAILED', error instanceof Error ? error.message : 'Failed to list skills'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderRegistryText(result: CliTextResult<RegistryDocument>) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  const registry = result.data
  const byProvider = registry.providers.map((provider) => {
    const count = registry.skills.filter((skill) => skill.provider === provider).length
    return `${provider}: ${count}`
  })

  return [
    `Workspace: ${registry.workspaceRoot}`,
    `Skills: ${registry.skills.length}`,
    `Sources: user=${registry.sources.user} workspace=${registry.sources.workspace}`,
    `Providers: ${byProvider.join(', ')}`,
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}
