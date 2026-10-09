import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  close: vi.fn(async () => 'closed'),
  send: vi.fn(() => ({})),
  noteFence: vi.fn()
}))

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/structured-agent-session-close', () => ({
  closeStructuredAgentSession: mocks.close
}))
vi.mock('@/components/native-chat/structured-agent-session-send-attempt', () => ({
  noteStructuredAgentSessionFence: mocks.noteFence
}))
vi.mock('@/components/native-chat/structured-agent-session-message-sender', () => ({
  sendStructuredAgentSessionMessage: mocks.send
}))
vi.mock('@/lib/browser-uuid', () => ({
  createBrowserUuid: () => '12345678-1234-4234-8234-123456789abc'
}))

const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value)
})

async function loadStore() {
  vi.resetModules()
  return (await import('./orca-assistant-sessions')).useOrcaAssistantSessions
}

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  mocks.call.mockImplementation(async (_target: unknown, _method: string, params: unknown) => ({
    ok: true,
    value: {
      sessionId: Reflect.get(Reflect.get(Object(params), 'envelope'), 'sessionId'),
      fence: 3
    }
  }))
})

describe('Orca assistant chats', () => {
  it('creates a chat in the assistant folder on this host and sends its first message', async () => {
    const store = await loadStore()

    const sessionId = await store.getState().startSession('claude', 'hello')

    expect(sessionId).toBe('claude_12345678_1234_4234_8234_123456789abc')
    expect(mocks.call).toHaveBeenCalledWith(
      { kind: 'local' },
      'agentSession.create',
      expect.objectContaining({
        worktree: 'id:global-floating-terminal',
        agent: 'claude',
        launchDirectory: 'orca-assistant'
      })
    )
    expect(mocks.noteFence).toHaveBeenCalledWith('claude_12345678_1234_4234_8234_123456789abc', 3)
    expect(mocks.send).toHaveBeenCalledWith({
      sessionId: 'claude_12345678_1234_4234_8234_123456789abc',
      target: { kind: 'local' },
      text: 'hello'
    })
    expect(store.getState()).toMatchObject({ activeSessionId: sessionId, creating: null })
  })

  it('remembers the chats across reloads and forgets a closed one', async () => {
    const first = await loadStore()
    await first.getState().startSession('codex')

    first.getState().rememberTitle('codex_12345678_1234_4234_8234_123456789abc', 'Deploy check')

    const reloaded = await loadStore()
    expect(reloaded.getState().sessions).toMatchObject([{ agent: 'codex', title: 'Deploy check' }])

    await reloaded.getState().close('codex_12345678_1234_4234_8234_123456789abc')
    expect(mocks.close).toHaveBeenCalledWith(
      { kind: 'local' },
      'codex_12345678_1234_4234_8234_123456789abc'
    )
    expect((await loadStore()).getState().sessions).toEqual([])
  })

  it('keeps the refusal to show instead of adding a chat', async () => {
    mocks.call.mockResolvedValue({
      ok: false,
      refusal: { code: 'x', message: 'Claude is not signed in' }
    })
    const store = await loadStore()

    await expect(store.getState().startSession('claude')).resolves.toBeNull()

    expect(store.getState()).toMatchObject({
      sessions: [],
      creating: null,
      createError: 'Claude is not signed in'
    })
  })
})
