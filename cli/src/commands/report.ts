import type { Command } from 'commander'

import { success, failure } from '../contracts.js'
import { resolveHomeDir, resolveWorkspaceRoot, type GovernanceCommandOptions } from '../cli.js'
import { createAuditSummary } from '../governance/audit.js'
import { createSkillClusters } from '../governance/cluster.js'
import { findDuplicateGroups } from '../governance/dedupe.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
} from '../cli.js'
import { readRuntimeProjectionSet } from '../store/runtime.js'
import { resolveSkillGovernorRoot } from '../store/paths.js'

export function registerReportCommand(program: Command): Command {
  const command = program
    .command('report')
    .description('Generate a governance report')
    .option('--scope <scope>', 'target scope for runtime projection summary', 'workspace')
    .option('--store-root <path>', 'store root override for runtime projection summary')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: GovernanceCommandOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const audit = createAuditSummary(registry.skills)
      const duplicateGroups = findDuplicateGroups(registry.skills)
      const clusters = createSkillClusters(registry.skills)
      const runtimeProjection = await readRuntimeProjectionSet(resolveTargetStoreRoot(options))

      emitResult(
        success({
          generatedAt: registry.generatedAt,
          workspaceRoot: registry.workspaceRoot,
          audit,
          duplicateGroups: duplicateGroups.groups,
          clusters,
          runtimeProjection: runtimeProjection === null
            ? null
            : {
              activeProfile: runtimeProjection.activeProfile,
              planId: runtimeProjection.planId,
              byProvider: Object.fromEntries(runtimeProjection.providers.map((projection) => [
                projection.provider,
                {
                  included: projection.includedSkills.length,
                  excluded: projection.excludedSkills.length,
                },
              ])),
            },
        }),
        resolveFormat(options.format),
        renderReportText,
      )
    } catch (error) {
      emitResult(
        failure('REPORT_FAILED', error instanceof Error ? error.message : 'Failed to generate report'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderReportText(result: { ok: true; data: { workspaceRoot: string; generatedAt: string; audit: { totalSkills: number; inferredCount: number; warningCount: number }; duplicateGroups: Array<{ id: string }>; clusters: { domainCount: number; keywordCount: number }; runtimeProjection: null | { activeProfile: string | null; planId: string | null; byProvider: Record<string, { included: number; excluded: number }> } } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  const projectionSummary = result.data.runtimeProjection === null
    ? 'none'
    : Object.entries(result.data.runtimeProjection.byProvider)
      .map(([provider, counts]) => `${provider}: ${counts.included} included / ${counts.excluded} excluded`)
      .join(', ') || 'none'

  return [
    `Workspace: ${result.data.workspaceRoot}`,
    `Generated at: ${result.data.generatedAt}`,
    `Total skills: ${result.data.audit.totalSkills}`,
    `Duplicate groups: ${result.data.duplicateGroups.length}`,
    `Clusters: ${result.data.clusters.domainCount} domains / ${result.data.clusters.keywordCount} keyword clusters`,
    `Warnings: ${result.data.audit.warningCount}`,
    `Runtime projection: ${projectionSummary}`,
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
