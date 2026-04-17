// @ts-ignore - Node types are not wired into this repo yet.
import { readdir, rm } from 'node:fs/promises'

import type {
  GovernancePlan,
  ProfileDocument,
  SnapshotDocument,
  StateDocument,
  SkillAction,
} from './types.js'
import { readGovernancePlan } from './store/plans.js'
import { captureSnapshot, readSnapshotDocument } from './store/snapshots.js'
import {
  readStateDocument,
  writeStateDocument,
} from './store/state.js'
import {
  readProfileDocument,
  writeProfileDocument,
} from './store/profiles.js'
import { refreshRuntimeProjections } from './runtime/resolve.js'
import {
  resolveProfileFilePath,
  resolveProfilesDir,
  resolveSnapshotsDir,
  resolveStateFilePath,
} from './store/paths.js'

export class GovernanceWorkflowError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'GovernanceWorkflowError'
    this.code = code
    this.details = details
  }
}

export interface ApplyPlanInput {
  storeRoot: string
  planId: string
  snapshotId?: string
  now?: string
}

export interface ApplyPreviewResult {
  dryRun: true
  applied: false
  storeRoot: string
  planId: string
  profileNames: string[]
  changedSkills: number
  duplicateGroups: number
  warnings: string[]
}

export interface ApplyPlanResult {
  dryRun: false
  applied: true
  storeRoot: string
  planId: string
  snapshot: SnapshotDocument
  state: StateDocument
  writtenProfiles: string[]
  replacedProfiles: string[]
}

export interface RollbackSnapshotInput {
  storeRoot: string
  snapshotId?: string
  now?: string
}

export interface RollbackSnapshotResult {
  rolledBack: true
  storeRoot: string
  snapshot: SnapshotDocument
  restoredState: StateDocument | null
  restoredProfiles: string[]
  removedProfiles: string[]
}

export interface ActivateProfileInput {
  storeRoot: string
  profileName: string
  snapshotId?: string
  now?: string
}

export interface ActivateProfileResult {
  activated: true
  storeRoot: string
  profileName: string
  snapshot: SnapshotDocument
  state: StateDocument
}

export async function previewApplyPlan(
  input: ApplyPlanInput,
): Promise<ApplyPreviewResult> {
  const plan = await readRequiredPlan(input.storeRoot, input.planId)

  return {
    dryRun: true,
    applied: false,
    storeRoot: input.storeRoot,
    planId: plan.id,
    profileNames: plan.profileDrafts.map((profile) => profile.name),
    changedSkills: plan.summary.changedSkills,
    duplicateGroups: plan.summary.duplicateGroups,
    warnings: [...plan.warnings],
  }
}

export async function applyPlan(
  input: ApplyPlanInput,
): Promise<ApplyPlanResult> {
  const plan = await readRequiredPlan(input.storeRoot, input.planId)
  const previousState = await readStateDocument(input.storeRoot)
  const previousProfiles = await readCurrentProfiles(input.storeRoot)

  const snapshot = await captureSnapshot({
    storeRoot: input.storeRoot,
    snapshotId: input.snapshotId,
    createdAt: input.now,
    previousState,
    previousProfiles,
    basedOnPlanId: plan.id,
  })

  const previousProfileNames = new Set(previousProfiles.map((profile) => profile.name))
  const writtenProfiles: string[] = []

  for (const profile of dedupeProfiles(plan.profileDrafts)) {
    await writeProfileDocument(input.storeRoot, profile)
    writtenProfiles.push(profile.name)
  }

  const state = buildAppliedState(previousState, plan, input.now)
  await writeStateDocument(input.storeRoot, state)
  await refreshRuntimeProjections({
    storeRoot: input.storeRoot,
    state,
    generatedAt: state.updatedAt,
  })

  return {
    dryRun: false,
    applied: true,
    storeRoot: input.storeRoot,
    planId: plan.id,
    snapshot,
    state,
    writtenProfiles,
    replacedProfiles: writtenProfiles.filter((profileName) => previousProfileNames.has(profileName)),
  }
}

export async function rollbackSnapshot(
  input: RollbackSnapshotInput,
): Promise<RollbackSnapshotResult> {
  const snapshot = input.snapshotId !== undefined
    ? await readRequiredSnapshot(input.storeRoot, input.snapshotId)
    : await readLatestSnapshot(input.storeRoot)

  if (snapshot === null) {
    throw new GovernanceWorkflowError(
      'SNAPSHOT_NOT_FOUND',
      input.snapshotId !== undefined
        ? `Snapshot '${input.snapshotId}' was not found in ${input.storeRoot}`
        : `No snapshots were found in ${input.storeRoot}`,
    )
  }

  const currentProfiles = await readCurrentProfiles(input.storeRoot)
  const currentProfileNames = new Set(currentProfiles.map((profile) => profile.name))
  const restoredProfileNames = new Set(snapshot.previousProfiles.map((profile) => profile.name))

  for (const profile of snapshot.previousProfiles) {
    await writeProfileDocument(input.storeRoot, profile)
  }

  const removedProfiles: string[] = []
  for (const profileName of currentProfileNames) {
    if (restoredProfileNames.has(profileName)) {
      continue
    }

    await rm(resolveProfileFilePath(input.storeRoot, profileName), { force: true })
    removedProfiles.push(profileName)
  }

  if (snapshot.previousState === null) {
    await rm(resolveStateFilePath(input.storeRoot), { force: true })
  } else {
    await writeStateDocument(input.storeRoot, snapshot.previousState)
  }

  await refreshRuntimeProjections({
    storeRoot: input.storeRoot,
    state: snapshot.previousState,
    generatedAt: input.now,
  })

  return {
    rolledBack: true,
    storeRoot: input.storeRoot,
    snapshot,
    restoredState: snapshot.previousState,
    restoredProfiles: snapshot.previousProfiles.map((profile) => profile.name),
    removedProfiles,
  }
}

export async function activateProfile(
  input: ActivateProfileInput,
): Promise<ActivateProfileResult> {
  const profile = await readProfileDocument(input.storeRoot, input.profileName)
  if (profile === null) {
    throw new GovernanceWorkflowError(
      'PROFILE_NOT_FOUND',
      `Profile '${input.profileName}' was not found in ${input.storeRoot}`,
    )
  }

  const previousState = await readStateDocument(input.storeRoot)
  const previousProfiles = await readCurrentProfiles(input.storeRoot)
  const snapshot = await captureSnapshot({
    storeRoot: input.storeRoot,
    snapshotId: input.snapshotId,
    createdAt: input.now,
    previousState,
    previousProfiles,
    basedOnPlanId: previousState?.lastAppliedPlanId ?? null,
  })

  const state = {
    version: 1 as const,
    activeProfile: profile.name,
    lastAppliedPlanId: previousState?.lastAppliedPlanId ?? null,
    selectedSources: previousState?.selectedSources ?? ['user', 'workspace'],
    selectedProviders: previousState?.selectedProviders ?? [],
    updatedAt: input.now ?? new Date().toISOString(),
  }

  await writeStateDocument(input.storeRoot, state)
  await refreshRuntimeProjections({
    storeRoot: input.storeRoot,
    state,
    generatedAt: state.updatedAt,
  })

  return {
    activated: true,
    storeRoot: input.storeRoot,
    profileName: profile.name,
    snapshot,
    state,
  }
}

async function readRequiredPlan(
  storeRoot: string,
  planId: string,
): Promise<GovernancePlan> {
  const plan = await readGovernancePlan(storeRoot, planId)
  if (plan === null) {
    throw new GovernanceWorkflowError(
      'PLAN_NOT_FOUND',
      `Plan '${planId}' was not found in ${storeRoot}`,
    )
  }

  return plan
}

async function readRequiredSnapshot(
  storeRoot: string,
  snapshotId: string,
): Promise<SnapshotDocument> {
  const snapshot = await readSnapshotDocument(storeRoot, snapshotId)
  if (snapshot === null) {
    throw new GovernanceWorkflowError(
      'SNAPSHOT_NOT_FOUND',
      `Snapshot '${snapshotId}' was not found in ${storeRoot}`,
    )
  }

  return snapshot
}

async function readLatestSnapshot(
  storeRoot: string,
): Promise<SnapshotDocument | null> {
  const snapshots = await readSnapshotDocuments(storeRoot)
  if (snapshots.length === 0) {
    return null
  }

  return [...snapshots].sort(compareSnapshots)[0] ?? null
}

async function readSnapshotDocuments(
  storeRoot: string,
): Promise<SnapshotDocument[]> {
  const snapshotDir = resolveSnapshotsDir(storeRoot)

  try {
    const entries = (await readdir(snapshotDir, { withFileTypes: true })) as Array<{
      name: string
      isFile(): boolean
    }>
    const ids = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -'.json'.length))

    const documents = await Promise.all(ids.map((snapshotId) => readSnapshotDocument(storeRoot, snapshotId)))
    return documents.filter((snapshot): snapshot is SnapshotDocument => snapshot !== null)
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return []
    }

    throw error
  }
}

async function readCurrentProfiles(
  storeRoot: string,
): Promise<ProfileDocument[]> {
  const profileDir = resolveProfilesDir(storeRoot)

  try {
    const entries = (await readdir(profileDir, { withFileTypes: true })) as Array<{
      name: string
      isFile(): boolean
    }>
    const names = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
      .map((entry) => entry.name.slice(0, -'.yaml'.length))

    const documents = await Promise.all(names.map((profileName) => readProfileDocument(storeRoot, profileName)))
    return documents.filter((profile): profile is ProfileDocument => profile !== null)
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return []
    }

    throw error
  }
}

function buildAppliedState(
  previousState: StateDocument | null,
  plan: GovernancePlan,
  now?: string,
): StateDocument {
  const selectedProviders = [
    ...(previousState?.selectedProviders ?? []),
    ...plan.actions.map((action) => action.provider),
  ]

  return {
    version: 1,
    activeProfile: plan.profileDrafts[0]?.name ?? previousState?.activeProfile ?? null,
    lastAppliedPlanId: plan.id,
    selectedSources: previousState?.selectedSources ?? ['user', 'workspace'],
    selectedProviders: uniqueProviders(selectedProviders),
    updatedAt: now ?? new Date().toISOString(),
  }
}

function uniqueProviders(values: readonly SkillAction['provider'][]): SkillAction['provider'][] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function dedupeProfiles(profiles: readonly ProfileDocument[]): ProfileDocument[] {
  const seen = new Set<string>()
  const unique: ProfileDocument[] = []

  for (const profile of profiles) {
    if (seen.has(profile.name)) {
      continue
    }

    seen.add(profile.name)
    unique.push(profile)
  }

  return unique
}

function compareSnapshots(left: SnapshotDocument, right: SnapshotDocument): number {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt)
  }

  return right.snapshotId.localeCompare(left.snapshotId)
}

function isMissingDirectoryError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === 'ENOENT',
  )
}
