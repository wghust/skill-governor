import type { ProfileDocument } from '../types.js'

import { resolveProfileFilePath } from './paths.js'
import { readYamlFile, writeYamlFile } from './files.js'

export async function readProfileDocument(
  storeRoot: string,
  profileName: string,
): Promise<ProfileDocument | null> {
  return readYamlFile<ProfileDocument>(resolveProfileFilePath(storeRoot, profileName))
}

export async function writeProfileDocument(
  storeRoot: string,
  profile: ProfileDocument,
): Promise<void> {
  await writeYamlFile(resolveProfileFilePath(storeRoot, profile.name), profile)
}
