import type { ProfileDocument, SnapshotDocument, StateDocument } from '../types.js'

import { resolveSnapshotFilePath } from './paths.js'
import { readJsonFile, writeJsonFile } from './files.js'

export interface CaptureSnapshotInput {
  storeRoot: string
  snapshotId?: string
  createdAt?: string
  previousState?: StateDocument | null
  previousProfiles?: readonly ProfileDocument[]
  basedOnPlanId?: string | null
}

export async function readSnapshotDocument(
  storeRoot: string,
  snapshotId: string,
): Promise<SnapshotDocument | null> {
  return readJsonFile<SnapshotDocument>(resolveSnapshotFilePath(storeRoot, snapshotId))
}

export async function writeSnapshotDocument(
  storeRoot: string,
  snapshot: SnapshotDocument,
): Promise<void> {
  await writeJsonFile(resolveSnapshotFilePath(storeRoot, snapshot.snapshotId), snapshot)
}

export async function captureSnapshot(
  input: CaptureSnapshotInput,
): Promise<SnapshotDocument> {
  const snapshot: SnapshotDocument = {
    version: 1,
    snapshotId: input.snapshotId ?? buildSnapshotId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    previousState: input.previousState ?? null,
    previousProfiles: [...(input.previousProfiles ?? [])],
    basedOnPlanId: input.basedOnPlanId ?? null,
  }

  await writeSnapshotDocument(input.storeRoot, snapshot)
  return snapshot
}

function buildSnapshotId(): string {
  return `snapshot-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}
