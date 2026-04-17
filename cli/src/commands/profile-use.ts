import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import { emitResult, resolveFormat, resolveHomeDir, resolveWorkspaceRoot } from '../cli.js'
import type { GovernanceCommandOptions } from '../cli.js'
import type { JsonValue } from '../types.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'
import { activateProfile, GovernanceWorkflowError } from '../apply.js'

export function registerProfileUseCommand(program: Command): Command {
  const profile = program.command('profile').description('Manage governance profiles')

  const command = profile
    .command('use')
    .description('Activate a governance profile')
    .argument('<name>', 'profile name to activate')
    .option('--scope <scope>', 'target scope for profile activation')
    .option('--home-dir <path>', 'home directory for scope resolution')
    .option('--workspace-root <path>', 'workspace root for scope resolution')
    .option('--store-root <path>', 'store root override for profile activation')
    .option('--format <format>', 'output format', 'text')

  command.action(async (name: string, options: GovernanceCommandOptions) => {
    try {
      const storeRoot = resolveTargetStoreRoot(options)
      const result = await activateProfile({ storeRoot, profileName: name })
      emitResult(
        success(result),
        resolveFormat(options.format),
        renderProfileUseText,
      )
    } catch (error) {
      const workflowError = error instanceof GovernanceWorkflowError ? error : null
      emitResult(
        failure(
          workflowError?.code ?? 'PROFILE_USE_FAILED',
          error instanceof Error ? error.message : 'Failed to activate profile',
          normalizeDetails(workflowError?.details),
        ),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderProfileUseText(result: { ok: true; data: { activeProfile?: string; profileName: string; activated: boolean; storeRoot: string; snapshot?: { snapshotId: string }; state?: { activeProfile: string | null; lastAppliedPlanId: string | null } } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Active profile: ${result.data.activeProfile ?? result.data.profileName}`,
    `Activated: ${result.data.activated}`,
    `Store root: ${result.data.storeRoot}`,
    `Snapshot: ${result.data.snapshot?.snapshotId ?? 'none'}`,
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}

function resolveTargetStoreRoot(options: GovernanceCommandOptions): string {
  if (options.storeRoot?.trim()) {
    return options.storeRoot.trim()
  }

  if (options.scope === 'user' || options.scope === 'workspace') {
    return resolveSkillGovernorRoot(
      options.scope,
      resolveHomeDir(options),
      resolveWorkspaceRoot(options),
    )
  }

  throw new GovernanceWorkflowError(
    'STORE_ROOT_REQUIRED',
    'Use --store-root or select a scope with --scope user|workspace.',
  )
}

function normalizeDetails(details: unknown): JsonValue | undefined {
  return details === undefined ? undefined : (details as JsonValue)
}
