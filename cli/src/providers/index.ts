export {
  BUILTIN_PROVIDER_IDS,
  createProviderAdapter,
  findSkillEntryCandidates,
  type BuiltinProviderId,
  type ProviderAdapter,
} from './types.js'

export { cursorAdapter } from './cursor.js'
export { codexAdapter } from './codex.js'
export { claudeAdapter } from './claude.js'

import { claudeAdapter } from './claude.js'
import { codexAdapter } from './codex.js'
import { cursorAdapter } from './cursor.js'
import { BUILTIN_PROVIDER_IDS, type BuiltinProviderId, type ProviderAdapter } from './types.js'

const ADAPTERS: Record<BuiltinProviderId, ProviderAdapter> = {
  cursor: cursorAdapter,
  codex: codexAdapter,
  claude: claudeAdapter,
}

export function getProviderAdapter(provider: BuiltinProviderId): ProviderAdapter {
  return ADAPTERS[provider]
}

export function listProviderAdapters(): ProviderAdapter[] {
  return BUILTIN_PROVIDER_IDS.map((provider) => ADAPTERS[provider])
}
