import { describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { buildRuntimePtySpawnOptions } from '../runtime/spawn-options'
import { createRuntimePtySpawnState } from '../runtime/spawn-state'
import type { PtyRuntimeControllerDeps } from '../runtime/controller-deps'
import { buildPtyIpcSpawnOptions } from './spawn-options'
import { createPtyIpcSpawnState } from './spawn-state'
import type { PtySpawnIpcDeps } from './spawn-types'

function settingsWith(terminalEnvironmentVariables: Record<string, string>): GlobalSettings {
  return { ...getDefaultSettings('/tmp'), terminalEnvironmentVariables }
}

async function ipcSpawnEnv(
  userEnv: Record<string, string>,
  connectionId: string | null
): Promise<Record<string, string> | undefined> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: buildPtyIpcSpawnOptions only reads the members stubbed here; the rest belong to later spawn stages this test never runs.
  const deps = {
    transitionSpawnHiddenRendererPtyDeliveryState: vi.fn(),
    getSettings: () => settingsWith(userEnv),
    runtime: { registerPreAllocatedHandleForPty: vi.fn() }
  } as unknown as PtySpawnIpcDeps
  const ctx = createPtyIpcSpawnState(deps, { cols: 80, rows: 24, connectionId })
  ctx.env = { KEEP: '1', SHARED: 'launch' }
  await buildPtyIpcSpawnOptions(ctx)
  return ctx.spawnOptions.env
}

async function runtimeSpawnEnv(
  userEnv: Record<string, string>,
  connectionId: string | null
): Promise<Record<string, string> | undefined> {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: buildRuntimePtySpawnOptions only reads getSettings here; the rest belong to later spawn stages this test never runs.
  const deps = { getSettings: () => settingsWith(userEnv) } as unknown as PtyRuntimeControllerDeps
  const ctx = createRuntimePtySpawnState(deps, { cols: 80, rows: 24, connectionId })
  ctx.env = { KEEP: '1', SHARED: 'launch' }
  await buildRuntimePtySpawnOptions(ctx)
  return ctx.spawnOptions.env
}

describe.each([
  ['renderer spawn', ipcSpawnEnv],
  ['runtime spawn', runtimeSpawnEnv]
])('%s: terminal environment variables', (_name, spawnEnv) => {
  it('adds them to local terminals beneath the launch env', async () => {
    expect(await spawnEnv({ API_BASE: 'http://localhost', SHARED: 'user' }, null)).toEqual({
      API_BASE: 'http://localhost',
      KEEP: '1',
      SHARED: 'launch'
    })
  })

  it('leaves SSH terminals alone', async () => {
    expect(await spawnEnv({ API_BASE: 'http://localhost' }, 'ssh-1')).toEqual({
      KEEP: '1',
      SHARED: 'launch'
    })
  })
})
