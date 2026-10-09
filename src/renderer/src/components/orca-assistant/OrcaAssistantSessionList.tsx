import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentDisplayLabel } from '@/lib/orca-assistant'
import {
  ORCA_ASSISTANT_AGENTS,
  useOrcaAssistantSessions,
  type OrcaAssistantAgent
} from '@/store/orca-assistant-sessions'
import { OrcaAssistantSessionRow } from './OrcaAssistantSessionRow'

export function OrcaAssistantNewSessionMenu({
  onStart,
  variant = 'outline'
}: {
  onStart: (agent: OrcaAssistantAgent) => void
  variant?: 'outline' | 'default'
}): React.JSX.Element {
  const creating = useOrcaAssistantSessions((state) => state.creating !== null)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={variant} size="sm" disabled={creating}>
          <Plus />
          {translate('orcaAssistant.page.newSession', 'New chat')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ORCA_ASSISTANT_AGENTS.map((agent) => (
          <DropdownMenuItem key={agent} onSelect={() => onStart(agent)}>
            <AgentIcon agent={agent} size={14} />
            {agentDisplayLabel(agent)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function OrcaAssistantSessionList({
  onStart
}: {
  onStart: (agent: OrcaAssistantAgent) => void
}): React.JSX.Element {
  const sessions = useOrcaAssistantSessions((state) => state.sessions)
  const activeSessionId = useOrcaAssistantSessions((state) => state.activeSessionId)
  const select = useOrcaAssistantSessions((state) => state.select)
  const close = useOrcaAssistantSessions((state) => state.close)
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="text-sm font-medium">
          {translate('orcaAssistant.page.title', 'Orca Assistant')}
        </h2>
        <OrcaAssistantNewSessionMenu onStart={onStart} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5 scrollbar-sleek">
        {sessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {translate('orcaAssistant.page.noSessions', 'No chats yet.')}
          </div>
        ) : (
          sessions.map((session) => (
            <OrcaAssistantSessionRow
              key={session.sessionId}
              session={session}
              selected={session.sessionId === activeSessionId}
              onSelect={() => select(session.sessionId)}
              onClose={() => void close(session.sessionId)}
            />
          ))
        )}
      </div>
    </aside>
  )
}
