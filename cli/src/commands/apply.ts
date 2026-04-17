import type { Command } from 'commander'

import { success, failure } from '../contracts.js'
import { emitResult, resolveFormat, resolveHomeDir, resolveWorkspaceRoot } from '../cli.js'
import type { GovernanceCommandOptions } from '../cli.js'
import type { JsonValue } from '../types.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'
import { applyPlan, GovernanceWorkflowError, previewApplyPlan } from '../apply.js'

export function registerApplyCommand(program: Command): Command {
  const command = program
    .command('apply')
    .description('Apply a governance plan')
    .option('--plan <id>', 'plan id or file path')
    .option('--scope <scope>', 'target scope for apply')
    .option('--home-dir <path>', 'home directory for scope resolution')
    .option('--workspace-root <path>', 'workspace root for scope resolution')
    .option('--store-root <path>', 'store root override for apply')
    .option('--dry-run', 'preview the apply operation')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: GovernanceCommandOptions) => {
    try {
      const storeRoot = resolveTargetStoreRoot(options)
      const planId = requirePlanId(options)

      if (options.dryRun === true) {
        const preview = await previewApplyPlan({ storeRoot, planId })
        emitResult(success(preview), resolveFormat(options.format), renderApplyText)
        return
      }

      const result = await applyPlan({ storeRoot, planId })
      emitResult(success(result), resolveFormat(options.format), renderApplyText)
    } catch (error) {
      const workflowError = error instanceof GovernanceWorkflowError ? error : null
      emitResult(
        failure(
          workflowError?.code ?? 'APPLY_FAILED',
          error instanceof Error ? error.message : 'Failed to apply plan',
          normalizeDetails(workflowError?.details),
        ),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderApplyText(result: { ok: true; data: { applied: boolean; dryRun: boolean; planId: string; storeRoot: string; profileNames?: string[]; changedSkills?: number; duplicateGroups?: number; warnings?: string[]; snapshot?: { snapshotId: string }; state?: { activeProfile: string | null; lastAppliedPlanId: string | null }; writtenProfiles?: string[]; replacedProfiles?: string[] } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Applied: ${result.data.applied}`,
    `Dry run: ${result.data.dryRun}`,
    `Plan: ${result.data.planId}`,
    `Store root: ${result.data.storeRoot}`,
    `Profiles: ${(result.data.profileNames ?? result.data.writtenProfiles ?? []).join(', ') || 'none'}`,
    `Snapshot: ${result.data.snapshot?.snapshotId ?? 'none'}`,
    `Active profile: ${result.data.state?.activeProfile ?? 'none'}`,
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}

function requirePlanId(options: GovernanceCommandOptions): string {
  const planId = options.plan?.trim()
  if (!planId) {
    throw new GovernanceWorkflowError('PLAN_REQUIRED', 'An apply plan id is required.')
  }

  return planId
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
