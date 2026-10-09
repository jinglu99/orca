import { PassThrough } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { handleOrcaMcpMessage, serveOrcaMcpOverStdio, type RunOrcaCommand } from './orca-mcp-server'

function isToolList(
  value: unknown
): value is { tools: { name: string; annotations: Record<string, unknown> }[] } {
  return typeof value === 'object' && value !== null && Array.isArray(Reflect.get(value, 'tools'))
}

const ok = (stdout: string) => ({ code: 0, stdout, stderr: '' })

function deps(runCommand: RunOrcaCommand = vi.fn(async () => ok('{}'))) {
  return { runCommand, version: '1.2.3' }
}

describe('handleOrcaMcpMessage', () => {
  it('answers initialize with the client version it supports, else its newest', async () => {
    const supported = await handleOrcaMcpMessage(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      deps()
    )
    expect(supported).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'orca', version: '1.2.3' }
      }
    })
    const unknown = await handleOrcaMcpMessage(
      { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } },
      deps()
    )
    expect(unknown).toMatchObject({ result: { protocolVersion: '2025-06-18' } })
  })

  it('does not answer notifications', async () => {
    await expect(
      handleOrcaMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, deps())
    ).resolves.toBeNull()
  })

  it('lists tools with their read-only hint', async () => {
    const response = await handleOrcaMcpMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      deps()
    )
    const annotationsOf = (name: string) => {
      const tools =
        response && 'result' in response && isToolList(response.result) ? response.result.tools : []
      return tools.find((tool) => tool.name === name)?.annotations
    }
    expect(annotationsOf('list_worktrees')).toMatchObject({ readOnlyHint: true })
    expect(annotationsOf('send_to_agent')).toMatchObject({ readOnlyHint: false })
  })

  it('runs a tool as its orca command with --json and returns the output', async () => {
    const runCommand = vi.fn(async () => ok('{"worktrees":[]}\n'))
    const response = await handleOrcaMcpMessage(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_worktrees' } },
      deps(runCommand)
    )
    expect(runCommand).toHaveBeenCalledWith(['worktree', 'ps', '--json'])
    expect(response).toEqual({
      jsonrpc: '2.0',
      id: 4,
      result: { content: [{ type: 'text', text: '{"worktrees":[]}' }] }
    })
  })

  it('reports a failed command as a tool error carrying the CLI output', async () => {
    const runCommand = vi.fn(async () => ({
      code: 1,
      stdout: '{"ok":false,"error":{"code":"selector_not_found"}}',
      stderr: ''
    }))
    const response = await handleOrcaMcpMessage(
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'show_worktree', arguments: { worktree: 'name:missing' } }
      },
      deps(runCommand)
    )
    expect(response).toMatchObject({
      result: {
        isError: true,
        content: [{ text: '{"ok":false,"error":{"code":"selector_not_found"}}' }]
      }
    })
  })

  it('refuses bad arguments without running anything', async () => {
    const runCommand = vi.fn(async () => ok('{}'))
    const response = await handleOrcaMcpMessage(
      { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'send_to_agent' } },
      deps(runCommand)
    )
    expect(runCommand).not.toHaveBeenCalled()
    expect(response).toMatchObject({ result: { isError: true } })
  })

  it('answers unknown tools and methods with JSON-RPC errors', async () => {
    await expect(
      handleOrcaMcpMessage(
        { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'rm_rf' } },
        deps()
      )
    ).resolves.toMatchObject({ error: { code: -32602 } })
    await expect(
      handleOrcaMcpMessage({ jsonrpc: '2.0', id: 8, method: 'resources/list' }, deps())
    ).resolves.toMatchObject({ error: { code: -32601 } })
  })
})

describe('serveOrcaMcpOverStdio', () => {
  it('answers each line and finishes in-flight calls before returning', async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    let release: () => void = () => undefined
    const runCommand = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          release = () => resolve(ok('{"done":true}'))
        })
    )
    const served = serveOrcaMcpOverStdio({ ...deps(runCommand), input, output })
    input.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'orca_status' } })}\n`
    )
    input.write('not json\n')
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' })}\n`)
    await vi.waitFor(() => expect(runCommand).toHaveBeenCalled())
    input.end()
    release()
    await served

    const replies = output
      .read()
      .toString()
      .trim()
      .split('\n')
      .map((line: string) => JSON.parse(line))
    // The slow tool call does not hold up the ping behind it.
    expect(replies.map((reply: { id: unknown }) => reply.id)).toEqual([null, 2, 1])
    expect(replies[0]).toMatchObject({ error: { code: -32700 } })
  })
})
