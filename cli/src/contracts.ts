import type {
  CliError,
  CliSuccess,
  RegistryDocument,
  JsonValue,
} from './types.js'

export function createEmptyRegistry(workspaceRoot: string): RegistryDocument {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    sources: {
      user: true,
      workspace: true,
    },
    providers: ['cursor', 'codex', 'claude'],
    skills: [],
  }
}

export function success<T>(data: T): CliSuccess<T> {
  return {
    ok: true,
    data,
  }
}

export function failure(
  code: string,
  message: string,
  details?: JsonValue,
): CliError {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }
}
