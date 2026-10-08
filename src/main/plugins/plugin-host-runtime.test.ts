import { describe, expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createPluginWorkerRuntime } from './plugin-host-runtime'
import { pluginWorkerCommandResultSchema } from '../../shared/plugins/plugin-host-protocol'

describe('plugin worker shutdown', () => {
  it('normalizes either manifest separator before importing the worker', async () => {
    const importModule = vi.fn(async () => ({ default: vi.fn() }))
    const runtime = createPluginWorkerRuntime({ send: vi.fn(), importModule })

    await runtime.handleMessage({
      type: 'init',
      pluginId: 'orca-samples.demo',
      pluginRoot: join('plugin-root'),
      mainEntry: 'nested\\worker.js',
      grantedCapabilities: []
    })

    expect(importModule).toHaveBeenCalledWith(
      pathToFileURL(join('plugin-root', 'nested', 'worker.js')).href
    )
  })

  it('awaits an optional deactivate export before exiting', async () => {
    let finishDeactivate!: () => void
    const deactivate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDeactivate = resolve
        })
    )
    const send = vi.fn()
    const exit = vi.fn()
    const runtime = createPluginWorkerRuntime({
      send,
      exit,
      importModule: async () => ({ default: vi.fn(), deactivate })
    })
    await runtime.handleMessage({
      type: 'init',
      pluginId: 'orca-samples.demo',
      pluginRoot: '/plugin',
      mainEntry: 'worker.js',
      grantedCapabilities: []
    })

    const shutdown = runtime.handleMessage({ type: 'shutdown' })
    await Promise.resolve()
    expect(deactivate).toHaveBeenCalledOnce()
    expect(exit).not.toHaveBeenCalled()
    finishDeactivate()
    await shutdown

    expect(exit).toHaveBeenCalledWith(0)
  })

  it('exits immediately when the plugin has no deactivate export', async () => {
    const exit = vi.fn()
    const runtime = createPluginWorkerRuntime({
      send: vi.fn(),
      exit,
      importModule: async () => ({ default: vi.fn() })
    })
    await runtime.handleMessage({
      type: 'init',
      pluginId: 'orca-samples.demo',
      pluginRoot: '/plugin',
      mainEntry: 'worker.js',
      grantedCapabilities: []
    })

    await runtime.handleMessage({ type: 'shutdown' })

    expect(exit).toHaveBeenCalledWith(0)
  })
})

describe('plugin worker command errors', () => {
  it('truncates long command errors so the parent still accepts the result', async () => {
    const send = vi.fn()
    const runtime = createPluginWorkerRuntime({
      send,
      importModule: async () => ({
        default: (orca: { commands: { register(id: string, handler: () => unknown): void } }) => {
          orca.commands.register('fail', () => {
            throw new Error('x'.repeat(20_000))
          })
        }
      })
    })
    await runtime.handleMessage({
      type: 'init',
      pluginId: 'orca-samples.demo',
      pluginRoot: '/plugin',
      mainEntry: 'worker.js',
      grantedCapabilities: []
    })

    await runtime.handleMessage({ type: 'invokeCommand', callId: 1, commandId: 'fail' })

    const result = send.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === 'commandResult')
    expect(result.ok).toBe(false)
    expect(pluginWorkerCommandResultSchema.safeParse(result).success).toBe(true)
  })
})
