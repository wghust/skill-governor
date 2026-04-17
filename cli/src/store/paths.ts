// @ts-ignore - Node types are not wired into this repo yet.
import { join } from 'node:path'

import type { SourceScope } from '../types.js'

export type StoreScope = SourceScope

const STORE_DIR_NAME = '.skill-governor'
const REGISTRY_FILE_NAME = 'registry.json'
const STATE_FILE_NAME = 'state.json'
const PROFILES_DIR_NAME = 'profiles'
const PLANS_DIR_NAME = 'plans'
const SNAPSHOTS_DIR_NAME = 'snapshots'
const RUNTIME_DIR_NAME = 'runtime'
const RUNTIME_INDEX_FILE_NAME = 'index.json'

export function resolveUserSkillGovernorRoot(homeDir: string): string {
  return join(homeDir, STORE_DIR_NAME)
}

export function resolveWorkspaceSkillGovernorRoot(workspaceRoot: string): string {
  return join(workspaceRoot, STORE_DIR_NAME)
}

export function resolveSkillGovernorRoot(
  scope: StoreScope,
  homeDir: string,
  workspaceRoot: string,
): string {
  return scope === 'user'
    ? resolveUserSkillGovernorRoot(homeDir)
    : resolveWorkspaceSkillGovernorRoot(workspaceRoot)
}

export function resolveRegistryFilePath(storeRoot: string): string {
  return join(storeRoot, REGISTRY_FILE_NAME)
}

export function resolveStateFilePath(storeRoot: string): string {
  return join(storeRoot, STATE_FILE_NAME)
}

export function resolveProfilesDir(storeRoot: string): string {
  return join(storeRoot, PROFILES_DIR_NAME)
}

export function resolvePlansDir(storeRoot: string): string {
  return join(storeRoot, PLANS_DIR_NAME)
}

export function resolveSnapshotsDir(storeRoot: string): string {
  return join(storeRoot, SNAPSHOTS_DIR_NAME)
}

export function resolveRuntimeDir(storeRoot: string): string {
  return join(storeRoot, RUNTIME_DIR_NAME)
}

export function resolveRuntimeIndexFilePath(storeRoot: string): string {
  return join(resolveRuntimeDir(storeRoot), RUNTIME_INDEX_FILE_NAME)
}

export function resolveProviderRuntimeDir(storeRoot: string, provider: string): string {
  return join(resolveRuntimeDir(storeRoot), sanitizeArtifactStem(provider))
}

export function resolveProviderRuntimeProjectionFilePath(storeRoot: string, provider: string): string {
  return join(resolveProviderRuntimeDir(storeRoot, provider), RUNTIME_INDEX_FILE_NAME)
}

export function resolveProfileFilePath(storeRoot: string, profileName: string): string {
  return join(resolveProfilesDir(storeRoot), `${sanitizeArtifactStem(profileName)}.yaml`)
}

export function resolvePlanFilePath(storeRoot: string, planId: string): string {
  return join(resolvePlansDir(storeRoot), `${sanitizeArtifactStem(planId)}.json`)
}

export function resolveSnapshotFilePath(storeRoot: string, snapshotId: string): string {
  return join(resolveSnapshotsDir(storeRoot), `${sanitizeArtifactStem(snapshotId)}.json`)
}

function sanitizeArtifactStem(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-+|-+$/gu, '')

  return normalized.length > 0 ? normalized : 'item'
}
