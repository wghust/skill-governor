// @ts-ignore - Node types are not wired into this repo yet.
import { join } from 'node:path'

import { createProviderAdapter } from './types.js'

export const claudeAdapter = createProviderAdapter({
  provider: 'claude',
  userRoots(homeDir: string): string[] {
    return [join(homeDir, '.claude', 'skills')]
  },
  workspaceRoots(workspaceRoot: string): string[] {
    return [join(workspaceRoot, '.claude', 'skills')]
  },
})
