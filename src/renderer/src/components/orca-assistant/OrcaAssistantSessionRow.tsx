import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SessionTime } from '@/components/right-sidebar/ai-vault-session-time'
import { translate } from '@/i18n/i18n'
import { AgentIcon } from '@/lib/agent-catalog'
import { cn } from '@/lib/utils'
import { useStructuredConversationName } from '@/runtime/structured-conversation-name'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import {
  useOrcaAssistantSessions,
  type OrcaAssistantSession
} from '@/store/orca-assistant-sessions'

export function OrcaAssistantSessionRow({
  session,
  selected,
  onSelect,
  onClose
}: {
  session: OrcaAssistantSession
  selected: boolean
  onSelect: () => void
  onClose: () => void
}): React.JSX.Element {
  const name = useStructuredConversationName(LOCAL_EXECUTION_HOST_ID, session.sessionId)
  const rememberTitle = useOrcaAssistantSessions((state) => state.rememberTitle)
  useEffect(() => {
    if (name && name !== session.title) {
      rememberTitle(session.sessionId, name)
    }
  }, [name, rememberTitle, session.sessionId, session.title])
  const title = name ?? session.title ?? translate('orcaAssistant.page.untitledSession', 'New chat')
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      data-current={selected ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring',
        selected && 'bg-accent'
      )}
    >
      <span className="inline-flex shrink-0">
        <AgentIcon agent={session.agent} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate" title={title}>
        {title}
      </span>
      <SessionTime value={new Date(session.createdAt).toISOString()} />
      <span className="inline-flex opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={translate('orcaAssistant.page.closeSession', 'Close chat')}
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
        >
          <X />
        </Button>
      </span>
    </div>
  )
}
