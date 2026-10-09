import { Bot } from 'lucide-react'
import NativeChatView from '@/components/native-chat/NativeChatView'
import { NativeChatLoadingCue } from '@/components/native-chat/NativeChatLoadingCue'
import { translate } from '@/i18n/i18n'
import {
  ORCA_ASSISTANT_TARGET,
  useOrcaAssistantSessions,
  type OrcaAssistantAgent
} from '@/store/orca-assistant-sessions'
import { OrcaAssistantNewSessionMenu, OrcaAssistantSessionList } from './OrcaAssistantSessionList'

function OrcaAssistantChatPane({
  onStart
}: {
  onStart: (agent: OrcaAssistantAgent) => void
}): React.JSX.Element {
  const session = useOrcaAssistantSessions((state) =>
    state.sessions.find((candidate) => candidate.sessionId === state.activeSessionId)
  )
  const creating = useOrcaAssistantSessions((state) => state.creating)
  const createError = useOrcaAssistantSessions((state) => state.createError)
  if (creating) {
    return <NativeChatLoadingCue />
  }
  if (createError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm text-destructive">
          {translate('orcaAssistant.page.createFailed', 'The chat could not start: {{reason}}', {
            reason: createError
          })}
        </p>
        <OrcaAssistantNewSessionMenu onStart={onStart} />
      </div>
    )
  }
  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Bot className="size-8 text-muted-foreground" />
        <p className="max-w-md text-sm text-muted-foreground">
          {translate(
            'orcaAssistant.page.emptyState',
            'Ask about your repositories, worktrees and agents, or have the assistant start and steer agents for you.'
          )}
        </p>
        <OrcaAssistantNewSessionMenu onStart={onStart} variant="default" />
      </div>
    )
  }
  return (
    <NativeChatView
      key={session.sessionId}
      mode="structured"
      tabId={`orca-assistant:${session.sessionId}`}
      sessionId={session.sessionId}
      target={ORCA_ASSISTANT_TARGET}
      agent={session.agent}
      isVisible
      isFocusedGroup
    />
  )
}

/** A page of Orca assistant chats: the list on the left, the selected conversation beside it. */
export default function OrcaAssistantPage(): React.JSX.Element {
  const startSession = useOrcaAssistantSessions((state) => state.startSession)
  const onStart = (agent: OrcaAssistantAgent): void => void startSession(agent)
  return (
    <div className="flex h-full min-h-0 bg-background">
      <OrcaAssistantSessionList onStart={onStart} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <OrcaAssistantChatPane onStart={onStart} />
      </main>
    </div>
  )
}
