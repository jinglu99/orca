import { Bot } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  countAgentsNeedingAttention,
  openOrcaAssistant,
  orcaAssistantAttentionPrompt
} from '@/lib/orca-assistant'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useOrcaAssistantSessions } from '@/store/orca-assistant-sessions'

/** The assistant page's sidebar entry, plus a count of agents waiting on the user. */
export function SidebarOrcaAssistantNavButton(): React.JSX.Element {
  const active = useAppStore((s) => s.activeView === 'assistant')
  const assistantSessionIds = useOrcaAssistantSessions(
    useShallow((s) => s.sessions.map((session) => session.sessionId))
  )
  const attentionCount = useAppStore((s) =>
    countAgentsNeedingAttention(s.agentStatusByPaneKey, assistantSessionIds)
  )
  const attentionLabel = translate(
    'orcaAssistant.attention',
    '{{count}} agents need you. Ask the Orca assistant what they need.',
    { count: attentionCount }
  )
  return (
    <div
      className={cn(
        'flex w-full items-center rounded-md text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <button
        type="button"
        onClick={() => void openOrcaAssistant()}
        aria-current={active ? 'page' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left"
      >
        <Bot
          className={cn('size-4 shrink-0', !active && 'text-worktree-sidebar-foreground/30')}
          strokeWidth={active ? 2.25 : 1.75}
        />
        <span className="flex-1">
          {translate('auto.components.sidebar.SidebarNav.orcaAssistant', 'Orca Assistant')}
        </span>
      </button>
      {attentionCount > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={attentionLabel}
              onClick={() => void openOrcaAssistant({ prompt: orcaAssistantAttentionPrompt() })}
              className="mr-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
            >
              {attentionCount}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{attentionLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
