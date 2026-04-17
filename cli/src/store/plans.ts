import type { GovernancePlan } from '../types.js'

import { resolvePlanFilePath } from './paths.js'
import { readJsonFile, writeJsonFile } from './files.js'

export async function readGovernancePlan(
  storeRoot: string,
  planId: string,
): Promise<GovernancePlan | null> {
  return readJsonFile<GovernancePlan>(resolvePlanFilePath(storeRoot, planId))
}

export async function writeGovernancePlan(
  storeRoot: string,
  plan: GovernancePlan,
): Promise<void> {
  await writeJsonFile(resolvePlanFilePath(storeRoot, plan.id), plan)
}
