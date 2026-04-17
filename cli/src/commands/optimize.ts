import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import { createGovernancePlan } from '../governance/optimize.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { GovernanceCommandOptions, RegistrySelectionOptions } from '../cli.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
  resolveHomeDir,
  resolveWorkspaceRoot,
} from '../cli.js'
import type { GovernancePolicy, JsonValue } from '../types.js'
import { writeGovernancePlan } from '../store/plans.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'
import { writeRegistryDocument } from '../store/state.js'
import { GovernanceWorkflowError } from '../apply.js'

export function registerOptimizeCommand(program: Command): Command {
  const command = program
    .command('optimize')
    .description('Generate a governance plan')
    .option('--policy <policy>', 'governance policy', 'balanced')
    .option('--dry-run', 'preview without writing changes', true)
    .option('--scope <scope>', 'target scope for persisted plans', 'workspace')
    .option('--store-root <path>', 'store root override for persisted plans')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: GovernanceCommandOptions & RegistrySelectionOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const policy = normalizePolicy(options.policy)
      const plan = createGovernancePlan(registry, policy)
      const storeRoot = resolveTargetStoreRoot(options)
      await writeRegistryDocument(storeRoot, registry)
      await writeGovernancePlan(storeRoot, plan)
      emitResult(
        success({
          ...plan,
          storeRoot,
          dryRun: options.dryRun !== false,
        }),
        resolveFormat(options.format),
        renderOptimizeText,
      )
    } catch (error) {
      const workflowError = error instanceof GovernanceWorkflowError ? error : null
      emitResult(
        failure(
          workflowError?.code ?? 'OPTIMIZE_FAILED',
          error instanceof Error ? error.message : 'Failed to optimize skills',
          normalizeDetails(workflowError?.details),
        ),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function normalizePolicy(value: string | undefined): GovernancePolicy {
  if (value === 'conservative' || value === 'aggressive') {
    return value
  }

  return 'balanced'
}

function renderOptimizeText(result: { ok: true; data: { id: string; policy: string; summary: { totalSkills: number; changedSkills: number; duplicateGroups: number; suggestedProfiles: string[] }; dryRun: boolean; storeRoot: string } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Plan: ${result.data.id}`,
    `Policy: ${result.data.policy}`,
    `Dry run: ${result.data.dryRun}`,
    `Store root: ${result.data.storeRoot}`,
    `Total skills: ${result.data.summary.totalSkills}`,
    `Changed skills: ${result.data.summary.changedSkills}`,
    `Duplicate groups: ${result.data.summary.duplicateGroups}`,
    `Suggested profiles: ${result.data.summary.suggestedProfiles.join(', ') || 'none'}`,
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}

function resolveTargetStoreRoot(options: GovernanceCommandOptions): string {
  if (options.storeRoot?.trim()) {
    return options.storeRoot.trim()
  }

  const scope = options.scope === 'user' ? 'user' : 'workspace'
  return resolveSkillGovernorRoot(
    scope,
    resolveHomeDir(options),
    resolveWorkspaceRoot(options),
  )
}

function normalizeDetails(details: unknown): JsonValue | undefined {
  return details === undefined ? undefined : (details as JsonValue)
}
