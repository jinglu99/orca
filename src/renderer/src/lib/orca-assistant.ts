// The Orca assistant: a page of chats with an agent launched in the app-owned folder whose
// instructions and MCP tools teach it to operate Orca. Every entry point (sidebar, shortcut,
// command palette, attention hint) goes through openOrcaAssistant.

import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { useAppStore } from '@/store'
import {
  ORCA_ASSISTANT_AGENTS,
  useOrcaAssistantSessions,
  type OrcaAssistantAgent
} from '@/store/orca-assistant-sessions'
import { isFreshNonDoneAgentStatus } from '../../../shared/agent-status-freshness'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { DEFAULT_DISABLED_TUI_AGENTS, isTuiAgentEnabled } from '../../../shared/tui-agent-selection'
import type { TuiAgent } from '../../../shared/tui-agent'

type AssistantSettings = Pick<GlobalSettings, 'defaultTuiAgent' | 'disabledTuiAgents'>
type AssistantStatusEntry = Parameters<typeof isFreshNonDoneAgentStatus>[0] &
  Pick<AgentStatusEntry, 'state'>

/** The user's default agent, when one is set and enabled. */
export function resolveOrcaAssistantAgent(
  settings: AssistantSettings | null | undefined
): TuiAgent | null {
  const agent = settings?.defaultTuiAgent ?? null
  const disabled = settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
  return agent && agent !== 'blank' && isTuiAgentEnabled(agent, disabled) ? agent : null
}

/** The agent a chat the user did not pick one for starts with: their default, when it can chat. */
export function defaultOrcaAssistantAgent(
  settings: AssistantSettings | null | undefined
): OrcaAssistantAgent {
  const preferred = resolveOrcaAssistantAgent(settings)
  return ORCA_ASSISTANT_AGENTS.find((agent) => agent === preferred) ?? 'claude'
}

export function agentDisplayLabel(agent: TuiAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

/** Agents (other than the assistant's own chats) stopped on a question or an approval right now. */
export function countAgentsNeedingAttention(
  agentStatusByPaneKey: Record<string, AssistantStatusEntry>,
  assistantSessionIds: readonly string[],
  now = Date.now()
): number {
  let count = 0
  for (const [paneKey, entry] of Object.entries(agentStatusByPaneKey)) {
    if (
      (entry.state === 'waiting' || entry.state === 'blocked') &&
      isFreshNonDoneAgentStatus(entry, now) &&
      !assistantSessionIds.some((sessionId) => paneKey.includes(sessionId))
    ) {
      count += 1
    }
  }
  return count
}

export function orcaAssistantAttentionPrompt(): string {
  return translate(
    'orcaAssistant.attentionPrompt',
    'Which of my agents are waiting for me or blocked right now, and what does each one need from me?'
  )
}

/**
 * Shows the assistant page. With a prompt, asks it: in the chat on screen when it can take a
 * message now, else in a new chat with the user's default agent.
 */
export async function openOrcaAssistant(options: { prompt?: string } = {}): Promise<void> {
  const app = useAppStore.getState()
  app.openAssistantPage()
  if (!options.prompt) {
    return
  }
  const chats = useOrcaAssistantSessions.getState()
  if (chats.activeSessionId && chats.ask(chats.activeSessionId, options.prompt)) {
    return
  }
  await chats.startSession(defaultOrcaAssistantAgent(app.settings), options.prompt)
}
