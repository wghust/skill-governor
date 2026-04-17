import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
  resolveHomeDir,
  resolveWorkspaceRoot,
} from '../cli.js'
import type { GovernanceCommandOptions } from '../cli.js'
import type { JsonValue, Provider, RuntimeProjectionSet } from '../types.js'
import { GovernanceWorkflowError } from '../apply.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import { writeRegistryDocument, readRegistryDocument } from '../store/state.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'
import { refreshRuntimeProjections } from '../runtime/resolve.js'

export function registerProjectionCommand(program: Command): Command {
  const command = program
    .command('projection')
    .description('Inspect or refresh runtime projections')
    .option('--refresh', 'rescan skills before generating runtime projections')
    .option('--scope <scope>', 'target scope for projection artifacts', 'workspace')
    .option('--store-root <path>', 'store root override for runtime projections')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: GovernanceCommandOptions) => {
    try {
      const storeRoot = resolveTargetStoreRoot(options)
      const registry = await resolveProjectionRegistry(storeRoot, options)
      const projectionSet = await refreshRuntimeProjections({ storeRoot, registry })

      emitResult(
        success(projectionSet),
        resolveFormat(options.format),
        renderProjectionText,
      )
    } catch (error) {
      const workflowError = error instanceof GovernanceWorkflowError ? error : null
      emitResult(
        failure(
          workflowError?.code ?? 'PROJECTION_FAILED',
          error instanceof Error ? error.message : 'Failed to generate runtime projections',
          normalizeDetails(workflowError?.details),
        ),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

async function resolveProjectionRegistry(
  storeRoot: string,
  options: GovernanceCommandOptions,
) {
  if (options.refresh === true) {
    const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
    await writeRegistryDocument(storeRoot, registry)
    return registry
  }

  const existing = await readRegistryDocument(storeRoot)
  if (existing !== null) {
    return existing
  }

  const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
  await writeRegistryDocument(storeRoot, registry)
  return registry
}

function renderProjectionText(result: { ok: true; data: RuntimeProjectionSet } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  const providers = result.data.providers.map((projection) =>
    `${projection.provider}: ${projection.includedSkills.length} included / ${projection.excludedSkills.length} excluded`,
  )

  return [
    `Generated at: ${result.data.generatedAt}`,
    `Active profile: ${result.data.activeProfile ?? 'none'}`,
    `Plan: ${result.data.planId ?? 'none'}`,
    `Providers: ${providers.join(', ') || 'none'}`,
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
