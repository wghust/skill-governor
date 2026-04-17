// @ts-ignore - Node types are not wired into this repo yet.
import { readdir, rm } from 'node:fs/promises'

import type { ProviderRuntimeProjection, RuntimeProjectionSet } from '../types.js'
import {
  resolveProviderRuntimeProjectionFilePath,
  resolveRuntimeDir,
  resolveRuntimeIndexFilePath,
} from './paths.js'
import { readJsonFile, writeJsonFile } from './files.js'

export async function readRuntimeProjectionSet(
  storeRoot: string,
): Promise<RuntimeProjectionSet | null> {
  return readJsonFile<RuntimeProjectionSet>(resolveRuntimeIndexFilePath(storeRoot))
}

export async function writeRuntimeProjectionSet(
  storeRoot: string,
  projectionSet: RuntimeProjectionSet,
): Promise<void> {
  await rm(resolveRuntimeDir(storeRoot), { recursive: true, force: true })
  await writeJsonFile(resolveRuntimeIndexFilePath(storeRoot), projectionSet)

  for (const projection of projectionSet.providers) {
    await writeJsonFile(
      resolveProviderRuntimeProjectionFilePath(storeRoot, projection.provider),
      projection,
    )
  }
}

export async function clearRuntimeProjectionSet(storeRoot: string): Promise<void> {
  await rm(resolveRuntimeDir(storeRoot), { recursive: true, force: true })
}

export async function readProviderRuntimeProjection(
  storeRoot: string,
  provider: string,
): Promise<ProviderRuntimeProjection | null> {
  return readJsonFile<ProviderRuntimeProjection>(
    resolveProviderRuntimeProjectionFilePath(storeRoot, provider),
  )
}

export async function listRuntimeProjectionProviders(storeRoot: string): Promise<string[]> {
  try {
    const entries = (await readdir(resolveRuntimeDir(storeRoot), { withFileTypes: true })) as Array<{
      name: string
      isDirectory(): boolean
    }>

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return []
    }

    throw error
  }
}

function isMissingDirectoryError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === 'ENOENT',
  )
}
