import { describe, expect, it } from 'vitest'
import { withTerminalEnvironmentVariables } from './terminal-environment-spawn-env'

describe('withTerminalEnvironmentVariables', () => {
  const settings = { terminalEnvironmentVariables: { FOO: 'user', BAR: 'user' } }

  it('returns the launch env untouched when nothing is configured', () => {
    const env = { A: '1' }
    expect(withTerminalEnvironmentVariables(env, {}, null)).toBe(env)
    expect(withTerminalEnvironmentVariables(undefined, null, null)).toBeUndefined()
  })

  it('lets the launch env win over the configured values', () => {
    expect(withTerminalEnvironmentVariables({ FOO: 'launch' }, settings, null, 'darwin')).toEqual({
      FOO: 'launch',
      BAR: 'user'
    })
  })

  it('never lets a stored ORCA_ name through', () => {
    expect(
      withTerminalEnvironmentVariables(
        {},
        { terminalEnvironmentVariables: { ORCA_PANE_KEY: 'spoof' } },
        null,
        'darwin'
      )
    ).toEqual({})
  })

  it('skips SSH terminals', () => {
    const env = { A: '1' }
    expect(withTerminalEnvironmentVariables(env, settings, 'ssh-1')).toBe(env)
  })

  it('names the variables in WSLENV on Windows so WSL shells receive them', () => {
    const result = withTerminalEnvironmentVariables(
      { WSLENV: 'ORCA_TAB_ID/u' },
      settings,
      null,
      'win32'
    )
    expect(result?.WSLENV?.split(':')).toEqual(['ORCA_TAB_ID/u', 'FOO', 'BAR'])
  })
})
