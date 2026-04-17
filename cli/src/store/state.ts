import type { RegistryDocument, StateDocument } from '../types.js'

import { resolveRegistryFilePath, resolveStateFilePath } from './paths.js'
import { readJsonFile, writeJsonFile } from './files.js'

export async function readRegistryDocument(
  storeRoot: string,
): Promise<RegistryDocument | null> {
  return readJsonFile<RegistryDocument>(resolveRegistryFilePath(storeRoot))
}

export async function writeRegistryDocument(
  storeRoot: string,
  registry: RegistryDocument,
): Promise<void> {
  await writeJsonFile(resolveRegistryFilePath(storeRoot), registry)
}

export async function readStateDocument(
  storeRoot: string,
): Promise<StateDocument | null> {
  return readJsonFile<StateDocument>(resolveStateFilePath(storeRoot))
}

export async function writeStateDocument(
  storeRoot: string,
  state: StateDocument,
): Promise<void> {
  await writeJsonFile(resolveStateFilePath(storeRoot), state)
}
