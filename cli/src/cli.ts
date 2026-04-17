// @ts-ignore - Node types are not wired into this repo yet.
import { homedir } from 'node:os'

import { Command } from 'commander'

import { registerAuditCommand } from './commands/audit.js'
import { registerApplyCommand } from './commands/apply.js'
import { registerClusterCommand } from './commands/cluster.js'
import { registerDedupeCommand } from './commands/dedupe.js'
import { registerInspectCommand } from './commands/inspect.js'
import { registerListCommand } from './commands/list.js'
import { registerOptimizeCommand } from './commands/optimize.js'
import { registerProfileUseCommand } from './commands/profile-use.js'
import { registerProjectionCommand } from './commands/projection.js'
import { registerReportCommand } from './commands/report.js'
import { registerRollbackCommand } from './commands/rollback.js'
import type { CliResult, GovernancePolicy, Provider, SourceScope } from './types.js'
import { failure } from './contracts.js'
import type { BuiltinProviderId } from './providers/types.js'
import {
  detectLegacyWorkspaceSkillGovernorRoot,
  resolveSkillGovernorRoot,
} from './store/paths.js'

type RuntimeProcess = {
  cwd?: () => string
}

const runtimeProcess = (globalThis as { process?: RuntimeProcess }).process

export type CommandFormat = 'json' | 'text'

export interface BaseCommandOptions {
  format?: string
  workspaceRoot?: string
  homeDir?: string
}

export interface RegistrySelectionOptions extends BaseCommandOptions {
  provider?: string[] | string
  sourceScope?: string[] | string
}

export interface GovernanceCommandOptions extends RegistrySelectionOptions {
  policy?: GovernancePolicy
  threshold?: string | number
  plan?: string
  snapshot?: string
  profile?: string
  scope?: SourceScope
  storeRoot?: string
  dryRun?: boolean
  refresh?: boolean
}

export class StoreResolutionError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'StoreResolutionError'
    this.code = code
    this.details = details
  }
}

export function buildCli(): Command {
  const program = new Command()
    .name('skill-governor')
    .description('AI-native skill governance CLI')
    .showHelpAfterError()

  registerListCommand(program)
  registerInspectCommand(program)
  registerAuditCommand(program)
  registerDedupeCommand(program)
  registerClusterCommand(program)
  registerOptimizeCommand(program)
  registerApplyCommand(program)
  registerRollbackCommand(program)
  registerProfileUseCommand(program)
  registerProjectionCommand(program)
  registerReportCommand(program)

  return program
}

export function resolveFormat(value: unknown): CommandFormat {
  return value === 'json' ? 'json' : 'text'
}

export function resolveWorkspaceRoot(options: BaseCommandOptions): string {
  return options.workspaceRoot?.trim() || runtimeProcess?.cwd?.() || '.'
}

export function resolveHomeDir(options: BaseCommandOptions): string {
  return options.homeDir?.trim() || homedir()
}

export function normalizeListOption(value: string[] | string | undefined): string[] {
  if (value === undefined) {
    return []
  }

  const items = Array.isArray(value) ? value : [value]
  return items
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function normalizeProviderSelection(
  value: string[] | string | undefined,
): BuiltinProviderId[] | undefined {
  const validProviders: BuiltinProviderId[] = ['cursor', 'codex', 'claude']
  const selected = normalizeListOption(value).filter(
    (item): item is BuiltinProviderId => validProviders.includes(item as BuiltinProviderId),
  )

  return selected.length > 0 ? [...new Set(selected)] : undefined
}

export function normalizeSourceScopeSelection(
  value: string[] | string | undefined,
): SourceScope[] | undefined {
  const selected = normalizeListOption(value).filter(
    (item): item is SourceScope => item === 'user' || item === 'workspace',
  )

  return selected.length > 0 ? [...new Set(selected)] : undefined
}

export function buildRegistryScanOptions(options: RegistrySelectionOptions) {
  return {
    workspaceRoot: resolveWorkspaceRoot(options),
    homeDir: resolveHomeDir(options),
    providers: normalizeProviderSelection(options.provider),
    sourceScopes: normalizeSourceScopeSelection(options.sourceScope),
  }
}

export function resolveGovernanceStoreRoot(options: GovernanceCommandOptions): string {
  if (options.storeRoot?.trim()) {
    return options.storeRoot.trim()
  }

  if (options.scope !== 'user' && options.scope !== 'workspace') {
    throw new StoreResolutionError(
      'STORE_ROOT_REQUIRED',
      'Use --store-root or select a scope with --scope user|workspace.',
    )
  }

  const workspaceRoot = resolveWorkspaceRoot(options)
  const storeRoot = resolveSkillGovernorRoot(
    options.scope,
    resolveHomeDir(options),
    workspaceRoot,
  )
  const legacyStoreRoot = detectLegacyWorkspaceSkillGovernorRoot(workspaceRoot, storeRoot)

  if (legacyStoreRoot !== null) {
    throw new StoreResolutionError(
      'LEGACY_STORE_FOUND',
      `Legacy workspace-local store detected at ${legacyStoreRoot}. Migrate it to ${storeRoot} or rerun with --store-root to select the legacy location explicitly.`,
      {
        legacyStoreRoot,
        storeRoot,
        workspaceRoot,
      },
    )
  }

  return storeRoot
}

export function emitResult<T>(
  result: CliResult<T>,
  format: CommandFormat,
  renderText: (result: any) => string[],
): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  for (const line of renderText(result)) {
    console.log(line)
  }
}
