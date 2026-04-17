// @ts-ignore - Node types are not wired into this repo yet.
import { join } from 'node:path'

import { createProviderAdapter } from './types.js'

export const cursorAdapter = createProviderAdapter({
  provider: 'cursor',
  userRoots(homeDir: string): string[] {
    return [join(homeDir, '.cursor', 'skills')]
  },
  workspaceRoots(workspaceRoot: string): string[] {
    return [join(workspaceRoot, '.cursor', 'skills')]
  },
})
