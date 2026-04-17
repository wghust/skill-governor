import { describe, expect, it } from 'vitest'
import { createEmptyRegistry, failure, success } from '../src/contracts.js'

describe('contracts', () => {
  it('creates a versioned empty registry', () => {
    const registry = createEmptyRegistry('/tmp/workspace')

    expect(registry).toMatchObject({
      version: 1,
      workspaceRoot: '/tmp/workspace',
      sources: {
        user: true,
        workspace: true,
      },
      providers: ['cursor', 'codex', 'claude'],
      skills: [],
    })
  })

  it('creates success and error envelopes', () => {
    expect(success({ totalSkills: 0 })).toEqual({
      ok: true,
      data: { totalSkills: 0 },
    })

    expect(failure('INVALID_STATE', 'State is invalid')).toEqual({
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: 'State is invalid',
      },
    })
  })
})
