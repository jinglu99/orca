import { describe, expect, it, vi } from 'vitest'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { updateSettings, type SettingsMutationOperations } from './settings-update'

function makeOperations(): SettingsMutationOperations {
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: updateSettings only reads settings and repos from this partial state.
    state: { settings: {}, repos: [] } as unknown as PersistedState,
    bumpLocalWorktreeScanGeneration: vi.fn(),
    removeRetainedBlob: vi.fn(),
    scheduleSave: vi.fn(),
    notifySettingsChanged: vi.fn()
  }
}

// Why at this boundary: desktop IPC, the web RPC and the CLI all write settings through it.
describe('updateSettings terminalEnvironmentVariables', () => {
  it('stores only usable variables', () => {
    const stored = updateSettings(makeOperations(), {
      terminalEnvironmentVariables: { ' FOO ': 'bar', ORCA_PANE_KEY: 'spoof' }
    }).terminalEnvironmentVariables
    expect(stored).toEqual({ FOO: 'bar' })
  })

  it('clears to an empty set', () => {
    const operations = makeOperations()
    updateSettings(operations, { terminalEnvironmentVariables: { FOO: 'bar' } })
    expect(
      updateSettings(operations, { terminalEnvironmentVariables: {} }).terminalEnvironmentVariables
    ).toEqual({})
  })
})
