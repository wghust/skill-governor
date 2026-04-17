// @ts-ignore - Node types are not wired into this repo yet.
import { join } from 'node:path'

import { createProviderAdapter } from './types.js'

export const codexAdapter = createProviderAdapter({
  provider: 'codex',
  userRoots(homeDir: string): string[] {
    return [join(homeDir, '.codex', 'skills')]
  },
  workspaceRoots(workspaceRoot: string): string[] {
    return [join(workspaceRoot, '.codex', 'skills')]
  },
})
