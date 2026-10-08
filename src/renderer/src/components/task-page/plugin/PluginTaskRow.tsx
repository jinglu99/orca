import { ArrowRight, ExternalLink } from 'lucide-react'
import type {
  PluginTaskItem,
  PluginTaskStatusTone
} from '../../../../../shared/plugins/plugin-task-provider'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '../../task-page-source-context'

const STATUS_TONE_CLASSES: Record<PluginTaskStatusTone, string> = {
  neutral: 'border-border/50 bg-muted/40 text-muted-foreground',
  info: 'border-border/50 bg-muted/40 text-foreground',
  success: 'border-status-success-border bg-status-success-background text-status-success',
  warning: 'border-border/50 bg-muted/40 text-foreground',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive'
}

export function PluginTaskStatusBadge({
  status
}: {
  status: NonNullable<PluginTaskItem['status']>
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        STATUS_TONE_CLASSES[status.tone ?? 'neutral']
      )}
    >
      <span className="truncate">{status.label}</span>
    </span>
  )
}

export function formatPluginTaskUpdatedAt(value: string | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null
  }
  return formatRelativeTime(value)
}

export function PluginTaskRow({
  item,
  selected,
  onOpen,
  onStartWorkspace
}: {
  item: PluginTaskItem
  selected: boolean
  onOpen: (item: PluginTaskItem) => void
  onStartWorkspace: (item: PluginTaskItem) => void
}): React.JSX.Element {
  const labels = item.labels?.slice(0, 3) ?? []
  const displayKey = item.key ?? item.id
  const updatedAt = formatPluginTaskUpdatedAt(item.updatedAt)
  return (
    // Why: the row contains action buttons, so a native button wrapper would
    // create invalid nested buttons; role + keyboard handling preserves access.
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item)
        }
      }}
      className={cn(
        'group/row grid min-h-12 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:grid-cols-[104px_minmax(0,1fr)_132px_96px_64px]',
        selected && 'bg-accent'
      )}
    >
      <span className="block truncate font-mono text-[12px] text-muted-foreground max-md:!hidden">
        {displayKey}
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground md:hidden">
            {displayKey}
          </span>
          <h3 className="min-w-0 truncate text-[13px] font-medium text-foreground">{item.title}</h3>
        </div>
        {item.project || labels.length > 0 || item.assignees?.length ? (
          <div className="mt-1 flex min-w-0 items-center gap-1">
            {item.project ? (
              <span className="max-w-[160px] truncate text-[10px] text-muted-foreground">
                {item.project}
              </span>
            ) : null}
            {labels.map((label) => (
              <span
                key={label}
                className="max-w-[140px] truncate rounded-full border border-border/50 bg-muted/35 px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
            {item.assignees?.length ? (
              <span className="min-w-0 truncate text-[10px] text-muted-foreground">
                {item.assignees.join(', ')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 max-md:!hidden">
        {item.status ? <PluginTaskStatusBadge status={item.status} /> : null}
      </div>

      <span className="block truncate text-[12px] text-muted-foreground max-md:!hidden">
        {updatedAt ?? ''}
      </span>

      <div className="flex shrink-0 items-center justify-end gap-1 md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(event) => {
                event.stopPropagation()
                onStartWorkspace(item)
              }}
              aria-label={translate(
                'auto.components.TaskPage.ff90d0abc7',
                'Start workspace from {{value0}}',
                { value0: displayKey }
              )}
            >
              <ArrowRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPage.9497f2787c', 'Start workspace')}
          </TooltipContent>
        </Tooltip>
        {item.url ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  if (item.url) {
                    void window.api.shell.openUrl(item.url)
                  }
                }}
                aria-label={translate(
                  'auto.components.TaskPage.pluginTaskOpenInBrowser',
                  'Open in browser'
                )}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.components.TaskPage.pluginTaskOpenInBrowser', 'Open in browser')}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
