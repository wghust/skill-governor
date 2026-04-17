import type { Command } from 'commander'

import { failure, success } from '../contracts.js'
import { createSkillClusters } from '../governance/cluster.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { RegistrySelectionOptions } from '../cli.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
} from '../cli.js'

export function registerClusterCommand(program: Command): Command {
  const command = program
    .command('cluster')
    .description('Cluster normalized skills by domain')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: RegistrySelectionOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const report = createSkillClusters(registry.skills)
      emitResult(success(report), resolveFormat(options.format), renderClusterText)
    } catch (error) {
      emitResult(
        failure('CLUSTER_FAILED', error instanceof Error ? error.message : 'Failed to cluster skills'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderClusterText(result: { ok: true; data: { domainCount: number; keywordCount: number; clusters: Array<{ label: string; skills: Array<{ name: string; id: string }> }> } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  return [
    `Domains: ${result.data.domainCount}`,
    `Keyword clusters: ${result.data.keywordCount}`,
    ...result.data.clusters.map((cluster) => `${cluster.label}: ${cluster.skills.length}`),
  ]
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}
