// @ts-ignore - Node types are not wired into this repo yet.
import { homedir } from 'node:os'

import { listProviderAdapters } from '../providers/index.js'
import type { BuiltinProviderId, ProviderAdapter } from '../providers/types.js'
import type { Provider, SourceScope } from '../types.js'

export interface SkillCandidate {
  provider: BuiltinProviderId
  sourceScope: SourceScope
  root: string
  entryFile: string
}

export interface RegistryScanInput {
  workspaceRoot: string
  homeDir?: string
  providers?: readonly BuiltinProviderId[]
  sourceScopes?: readonly SourceScope[]
}

const DEFAULT_SOURCE_SCOPES: readonly SourceScope[] = ['user', 'workspace']

export async function scanSkillCandidates(
  input: RegistryScanInput,
): Promise<SkillCandidate[]> {
  const adapters = resolveAdapters(input.providers)
  const sourceScopes = resolveSourceScopes(input.sourceScopes)
  const resolvedHomeDir = input.homeDir ?? homedir()

  const candidates: SkillCandidate[] = []

  for (const adapter of adapters) {
    for (const sourceScope of sourceScopes) {
      const roots = getRootsForScope(adapter, sourceScope, resolvedHomeDir, input.workspaceRoot)
      for (const root of roots) {
        const entryFiles = await adapter.findSkillEntryCandidates(root)
        for (const entryFile of entryFiles) {
          candidates.push({
            provider: adapter.provider,
            sourceScope,
            root,
            entryFile,
          })
        }
      }
    }
  }

  candidates.sort((left, right) => {
    return compareCandidateKey(left, right)
  })

  return candidates
}

function resolveAdapters(
  providers: readonly BuiltinProviderId[] | undefined,
): ProviderAdapter[] {
  const allAdapters = listProviderAdapters()
  if (!providers || providers.length === 0) {
    return allAdapters
  }

  const requested = new Set<Provider>(providers)
  return allAdapters.filter((adapter) => requested.has(adapter.provider))
}

function resolveSourceScopes(
  sourceScopes: readonly SourceScope[] | undefined,
): SourceScope[] {
  if (!sourceScopes || sourceScopes.length === 0) {
    return [...DEFAULT_SOURCE_SCOPES]
  }

  return [...new Set(sourceScopes)]
}

function getRootsForScope(
  adapter: ProviderAdapter,
  sourceScope: SourceScope,
  homeDir: string,
  workspaceRoot: string,
): string[] {
  if (sourceScope === 'user') {
    return adapter.getDefaultUserRoots(homeDir)
  }

  return adapter.getDefaultWorkspaceRoots(workspaceRoot)
}

function compareCandidateKey(left: SkillCandidate, right: SkillCandidate): number {
  const providerComparison = left.provider.localeCompare(right.provider)
  if (providerComparison !== 0) {
    return providerComparison
  }

  const sourceScopeComparison = left.sourceScope.localeCompare(right.sourceScope)
  if (sourceScopeComparison !== 0) {
    return sourceScopeComparison
  }

  const rootComparison = left.root.localeCompare(right.root)
  if (rootComparison !== 0) {
    return rootComparison
  }

  return left.entryFile.localeCompare(right.entryFile)
}
