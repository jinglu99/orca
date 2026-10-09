// The Orca assistant page's chats: structured sessions this client created on the local host, in
// the floating workspace but launched in the assistant folder. The host keeps each conversation;
// this list only remembers which ones the page shows, so it lives in this browser's storage.

import { create } from 'zustand'
import type {
  AgentSessionAttachResult,
  AgentSessionMutationResult
} from '../../../shared/agent-session-wire'
import {
  createStructuredAgentSessionId,
  structuredAgentSessionCreateParams
} from '../../../shared/structured-agent-session-create'
import { ORCA_ASSISTANT_LAUNCH_DIRECTORY } from '../../../shared/orca-assistant-session'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { closeStructuredAgentSession } from '@/runtime/structured-agent-session-close'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { noteStructuredAgentSessionFence } from '@/components/native-chat/structured-agent-session-send-attempt'
import { sendStructuredAgentSessionMessage } from '@/components/native-chat/structured-agent-session-message-sender'

export const ORCA_ASSISTANT_AGENTS = ['claude', 'codex'] as const
export type OrcaAssistantAgent = (typeof ORCA_ASSISTANT_AGENTS)[number]

export type OrcaAssistantSession = {
  sessionId: string
  agent: OrcaAssistantAgent
  createdAt: number
  /** The host's last name for the chat, kept so the list reads before the host reopens it. */
  title?: string
}

/** Claude and Codex structured chats run only on this machine, so the assistant asks this host. */
export const ORCA_ASSISTANT_TARGET: RuntimeClientTarget = { kind: 'local' }

const STORAGE_KEY = 'orca.assistant.sessions.v1'

type Persisted = { sessions: OrcaAssistantSession[]; activeSessionId: string | null }

function isAssistantAgent(value: unknown): value is OrcaAssistantAgent {
  return ORCA_ASSISTANT_AGENTS.some((agent) => agent === value)
}

function readPersisted(): Persisted {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) {
      return { sessions: [], activeSessionId: null }
    }
    const list: unknown = Reflect.get(raw, 'sessions')
    const sessions = Array.isArray(list)
      ? list.flatMap((entry: unknown): OrcaAssistantSession[] => {
          const sessionId: unknown = entry && Reflect.get(entry, 'sessionId')
          const agent: unknown = entry && Reflect.get(entry, 'agent')
          const createdAt: unknown = entry && Reflect.get(entry, 'createdAt')
          const title: unknown = entry && Reflect.get(entry, 'title')
          return typeof sessionId === 'string' &&
            isAssistantAgent(agent) &&
            typeof createdAt === 'number'
            ? [{ sessionId, agent, createdAt, ...(typeof title === 'string' ? { title } : {}) }]
            : []
        })
      : []
    const active: unknown = Reflect.get(raw, 'activeSessionId')
    const activeSessionId =
      typeof active === 'string' && sessions.some((session) => session.sessionId === active)
        ? active
        : (sessions[0]?.sessionId ?? null)
    return { sessions, activeSessionId }
  } catch {
    return { sessions: [], activeSessionId: null }
  }
}

function writePersisted(state: Persisted): void {
  try {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions: state.sessions, activeSessionId: state.activeSessionId })
    )
  } catch {
    // Best effort: an unwritable storage only forgets the list, never a conversation.
  }
}

type OrcaAssistantSessionsState = Persisted & {
  /** The agent of a chat being created, shown as starting until the host answers. */
  creating: OrcaAssistantAgent | null
  createError: string | null
  select: (sessionId: string) => void
  rememberTitle: (sessionId: string, title: string) => void
  /** Stops the chat's agent and drops it from the page; the host keeps its record. */
  close: (sessionId: string) => Promise<void>
  /** Creates a chat and selects it; with a prompt, sends it as the first message. */
  startSession: (agent: OrcaAssistantAgent, prompt?: string) => Promise<string | null>
  /** Sends a message to an existing chat; false when another send of it is still out. */
  ask: (sessionId: string, prompt: string) => boolean
}

async function createAssistantChat(agent: OrcaAssistantAgent): Promise<OrcaAssistantSession> {
  const sessionId = createStructuredAgentSessionId(agent, createBrowserUuid)
  const params = structuredAgentSessionCreateParams({
    sessionId,
    worktree: toRuntimeWorktreeSelector(FLOATING_TERMINAL_WORKTREE_ID),
    agent,
    launchDirectory: ORCA_ASSISTANT_LAUNCH_DIRECTORY,
    randomUuid: createBrowserUuid
  })
  const result = await callStructuredAgentSession<
    AgentSessionMutationResult<AgentSessionAttachResult>
  >(ORCA_ASSISTANT_TARGET, 'agentSession.create', params)
  if (!result.ok) {
    throw new Error(result.refusal.message)
  }
  noteStructuredAgentSessionFence(result.value.sessionId, result.value.fence)
  return { sessionId: result.value.sessionId, agent, createdAt: Date.now() }
}

export const useOrcaAssistantSessions = create<OrcaAssistantSessionsState>((set, get) => {
  const persist = (): void => writePersisted(get())
  return {
    ...readPersisted(),
    creating: null,
    createError: null,
    select: (sessionId) => {
      set({ activeSessionId: sessionId, createError: null })
      persist()
    },
    rememberTitle: (sessionId, title) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.sessionId === sessionId ? { ...session, title } : session
        )
      }))
      persist()
    },
    close: async (sessionId) => {
      const remaining = get().sessions.filter((session) => session.sessionId !== sessionId)
      set((state) => ({
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === sessionId
            ? (remaining[0]?.sessionId ?? null)
            : state.activeSessionId
      }))
      persist()
      try {
        await closeStructuredAgentSession(ORCA_ASSISTANT_TARGET, sessionId)
      } catch (error) {
        // The chat already left the page; a host that cannot close it stops it on its own exit.
        console.warn('[orca-assistant] closing a chat failed', error)
      }
    },
    startSession: async (agent, prompt) => {
      if (get().creating) {
        return null
      }
      set({ creating: agent, createError: null })
      let session: OrcaAssistantSession
      try {
        session = await createAssistantChat(agent)
      } catch (error) {
        set({ creating: null, createError: error instanceof Error ? error.message : String(error) })
        return null
      }
      set((state) => ({
        creating: null,
        sessions: [session, ...state.sessions],
        activeSessionId: session.sessionId
      }))
      persist()
      if (prompt?.trim()) {
        get().ask(session.sessionId, prompt)
      }
      return session.sessionId
    },
    ask: (sessionId, prompt) =>
      sendStructuredAgentSessionMessage({
        sessionId,
        target: ORCA_ASSISTANT_TARGET,
        text: prompt
      }) !== null
  }
})
