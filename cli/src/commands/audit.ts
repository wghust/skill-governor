import type { Command } from 'commander'

import { success, failure } from '../contracts.js'
import { createAuditSummary } from '../governance/audit.js'
import { scanAndNormalizeRegistry } from '../registry/index.js'
import type { RegistrySelectionOptions } from '../cli.js'
import {
  buildRegistryScanOptions,
  emitResult,
  resolveFormat,
} from '../cli.js'

export function registerAuditCommand(program: Command): Command {
  const command = program
    .command('audit')
    .description('Audit normalized skills')
    .option('--workspace-root <path>', 'workspace root to scan')
    .option('--home-dir <path>', 'home directory to scan')
    .option('--provider <provider...>', 'limit scanning to one or more providers')
    .option('--source-scope <scope...>', 'limit scanning to user or workspace scope')
    .option('--format <format>', 'output format', 'text')

  command.action(async (options: RegistrySelectionOptions) => {
    try {
      const registry = await scanAndNormalizeRegistry(buildRegistryScanOptions(options))
      const summary = createAuditSummary(registry.skills)
      emitResult(
        success({
          workspaceRoot: registry.workspaceRoot,
          summary,
        }),
        resolveFormat(options.format),
        renderAuditText,
      )
    } catch (error) {
      emitResult(
        failure('AUDIT_FAILED', error instanceof Error ? error.message : 'Failed to audit skills'),
        resolveFormat(options.format),
        renderFailureText,
      )
    }
  })

  return command
}

function renderAuditText(result: { ok: true; data: { workspaceRoot: string; summary: { totalSkills: number; byProvider: Record<string, number>; bySourceScope: Record<string, number>; byMode: Record<string, number>; inferredCount: number; warningCount: number } } } | { ok: false; error: { code: string; message: string } }) {
  if (!result.ok) {
    return renderFailureText(result)
  }

  const { summary } = result.data
  return [
    `Workspace: ${result.data.workspaceRoot}`,
    `Total skills: ${summary.totalSkills}`,
    `By provider: ${formatCounts(summary.byProvider)}`,
    `By source scope: ${formatCounts(summary.bySourceScope)}`,
    `By mode: ${formatCounts(summary.byMode)}`,
    `Inferred: ${summary.inferredCount}`,
    `Warnings: ${summary.warningCount}`,
  ]
}

function formatCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

function renderFailureText(result: { ok: false; error: { code: string; message: string } }) {
  return [`${result.error.code}: ${result.error.message}`]
}
