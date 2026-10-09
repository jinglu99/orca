import { describe, expect, it } from 'vitest'
import {
  normalizeTerminalEnvironmentVariables,
  parseTerminalEnvironmentDraft,
  stringifyTerminalEnvironmentDraft,
  TERMINAL_ENVIRONMENT_DRAFT_MAX_BYTES
} from './terminal-environment-variables'

describe('normalizeTerminalEnvironmentVariables', () => {
  it('keeps string values under trimmed names', () => {
    expect(normalizeTerminalEnvironmentVariables({ ' FOO ': 'a b', BAR: '' })).toEqual({
      FOO: 'a b',
      BAR: ''
    })
  })

  it("drops Orca's own names, unusable names and non-string or NUL values", () => {
    expect(
      normalizeTerminalEnvironmentVariables({
        ORCA_PANE_KEY: 'x',
        orca_tab_id: 'x',
        '': 'x',
        'A=B': 'x',
        NUM: 1,
        NUL: 'a\0b',
        OK: 'yes'
      })
    ).toEqual({ OK: 'yes' })
  })

  it('treats anything but a plain object as empty', () => {
    expect(normalizeTerminalEnvironmentVariables(undefined)).toEqual({})
    expect(normalizeTerminalEnvironmentVariables(['A=1'])).toEqual({})
    expect(normalizeTerminalEnvironmentVariables('A=1')).toEqual({})
  })
})

describe('terminal environment draft', () => {
  it('reads one NAME=value per line, keeping spaces and = inside values', () => {
    const draft = [
      '# local services',
      'API_BASE=http://localhost:8080',
      '',
      'export GREETING=hello world',
      'NODE_OPTIONS=--max-old-space-size=8192',
      'not a pair',
      '=missing-name'
    ].join('\r\n')
    expect(parseTerminalEnvironmentDraft(draft)).toEqual({
      env: {
        API_BASE: 'http://localhost:8080',
        GREETING: 'hello world',
        NODE_OPTIONS: '--max-old-space-size=8192'
      },
      tooLarge: false
    })
  })

  it('round-trips through the text form', () => {
    const env = { A: '1', B: 'two words' }
    expect(parseTerminalEnvironmentDraft(stringifyTerminalEnvironmentDraft(env)).env).toEqual(env)
  })

  it('refuses drafts too large to parse safely', () => {
    const draft = `A=${'x'.repeat(TERMINAL_ENVIRONMENT_DRAFT_MAX_BYTES)}`
    expect(parseTerminalEnvironmentDraft(draft)).toEqual({ env: {}, tooLarge: true })
  })
})
