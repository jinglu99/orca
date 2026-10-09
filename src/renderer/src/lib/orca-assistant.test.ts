import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  app: {} satisfies object,
  chats: {} satisfies object
}))

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.app } }))
vi.mock('@/store/orca-assistant-sessions', () => ({
  ORCA_ASSISTANT_AGENTS: ['claude', 'codex'],
  useOrcaAssistantSessions: { getState: () => mocks.chats }
}))
vi.mock('@/lib/agent-catalog', () => ({ getAgentCatalog: () => [] }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import {
  countAgentsNeedingAttention,
  defaultOrcaAssistantAgent,
  openOrcaAssistant,
  resolveOrcaAssistantAgent
} from './orca-assistant'

const LEAF = '11111111-1111-4111-8111-111111111111'

function status(
  state: 'working' | 'waiting' | 'blocked',
  extra: { restoredUnconfirmed?: boolean; updatedAt?: number } = {}
) {
  return { state, updatedAt: Date.now(), ...extra }
}

function setUp(chats: { activeSessionId?: string | null; askResult?: boolean } = {}) {
  const app = {
    settings: { defaultTuiAgent: 'codex' as const, disabledTuiAgents: [] },
    openAssistantPage: vi.fn()
  }
  const state = {
    activeSessionId: chats.activeSessionId ?? null,
    ask: vi.fn(() => chats.askResult ?? true),
    startSession: vi.fn(async () => 'new-session')
  }
  mocks.app = app
  mocks.chats = state
  return { app, chats: state }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assistant agents', () => {
  it('uses the enabled default agent, falling back to Claude when it cannot chat', () => {
    expect(
      resolveOrcaAssistantAgent({ defaultTuiAgent: 'blank', disabledTuiAgents: [] })
    ).toBeNull()
    expect(defaultOrcaAssistantAgent({ defaultTuiAgent: 'codex', disabledTuiAgents: [] })).toBe(
      'codex'
    )
    expect(defaultOrcaAssistantAgent({ defaultTuiAgent: 'gemini', disabledTuiAgents: [] })).toBe(
      'claude'
    )
  })
})

describe('countAgentsNeedingAttention', () => {
  it("counts fresh waiting and blocked agents, never the assistant's own chats", () => {
    expect(
      countAgentsNeedingAttention(
        {
          [`tab-a:${LEAF}`]: status('waiting'),
          [`tab-b:${LEAF}`]: status('blocked'),
          [`tab-c:${LEAF}`]: status('working'),
          [`tab-d:${LEAF}`]: status('waiting', { restoredUnconfirmed: true }),
          [`tab-e:${LEAF}`]: status('waiting', { updatedAt: Date.now() - 2 * 60 * 60 * 1000 }),
          'orca-assistant:claude_1:claude_1': status('waiting')
        },
        ['claude_1']
      )
    ).toBe(2)
  })
})

describe('openOrcaAssistant', () => {
  it('opens the page and leaves the chats alone without a prompt', async () => {
    const { app, chats } = setUp({ activeSessionId: 'claude_1' })

    await openOrcaAssistant()

    expect(app.openAssistantPage).toHaveBeenCalled()
    expect(chats.ask).not.toHaveBeenCalled()
    expect(chats.startSession).not.toHaveBeenCalled()
  })

  it('asks the chat on screen when it can take the message', async () => {
    const { chats } = setUp({ activeSessionId: 'claude_1' })

    await openOrcaAssistant({ prompt: 'what needs me?' })

    expect(chats.ask).toHaveBeenCalledWith('claude_1', 'what needs me?')
    expect(chats.startSession).not.toHaveBeenCalled()
  })

  it('starts a chat with the default agent when none can take it', async () => {
    const { chats } = setUp({ activeSessionId: 'claude_1', askResult: false })

    await openOrcaAssistant({ prompt: 'what needs me?' })

    expect(chats.startSession).toHaveBeenCalledWith('codex', 'what needs me?')
  })
})
