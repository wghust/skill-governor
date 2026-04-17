import { describe, expect, it } from 'vitest'
import { buildCli } from '../src/cli'

describe('buildCli', () => {
  it('registers the root command', () => {
    const program = buildCli()
    expect(program.name()).toBe('skill-governor')
  })
})
