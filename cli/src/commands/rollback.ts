import type { Command } from 'commander'

import { success, failure } from '../contracts.js'
import { emitResult, resolveFormat, resolveHomeDir, resolveWorkspaceRoot } from '../cli.js'
import type { GovernanceCommandOptions } from '../cli.js'
import type { JsonValue } from '../types.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'
import { GovernanceWorkflowError, rollbackSnapshot } from '../apply.js'

export function registerRollbackCommand(program: Command): Command {
  const command = program
    .command('rollback')
    .description('Rollback a governance snapshot')
    .argument('[snapshot]', 'snapshot id or path to restore')
    .option('--scope <scope>', 'target scope for rollback')
    .option('--home-dir <path>', 'home directory for scope resolution')
    .option('--workspace-root <path>', 'workspace root for scope resolution')
    .option('--store-root <path>', 'store root override for rollback')
    .option('--format <format>', 'output format', 'text')

  command.action(async (snapshot: string | undefined, options: GovernanceCommandOptions) => {
    try {
      const storeRoot = resolveTargetStoreRoot(options)
      const snapshotId = snapshot ?? options.snapshot ?? undefined
      const result = await rollbackSnapshot({ storeRoot, snapshotId })
      emitResult(success(result), resolveFormat(options.format), renderRollbackText)
    } catch (error) {
      const workflowError = error instanceof GovernanceWorkflowError ? error : null
      emitResult(
        failure(
          workflowError?.code ?? 'ROLLBACK_FAILED',
          error instanceof Error ? error.message : 'Failed to rollback snapshot',
          normalizeDetails(workflowError?.details),
        ),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderRollbackText(result: { ok: true; data: { rolledBack: boolean; storeRoot: string; snapshot: { snapshotId: string }; restoredState: { activeProfile: string | null; lastAppliedPlanId: string | null } | null; restoredProfiles: string[]; removedProfiles: string[] } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Rolled back: ${result.data.rolledBack}`,
    `Snapshot: ${result.data.snapshot.snapshotId}`,
    `Store root: ${result.data.storeRoot}`,
    `Restored profiles: ${result.data.restoredProfiles.join(', ') || 'none'}`,
    `Removed profiles: ${result.data.removedProfiles.join(', ') || 'none'}`,
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
