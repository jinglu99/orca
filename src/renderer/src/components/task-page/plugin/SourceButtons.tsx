import { usePluginTaskSources, usePluginTaskSourceSelection } from '@/store/plugin-task-sources'
import { resolvePluginPanelIcon } from '@/components/right-sidebar/plugin-panel-activity-items'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Source-bar buttons for task providers contributed by enabled plugins. */
export function TaskPagePluginSourceButtons({
  activeKey
}: {
  activeKey: string | null
}): React.JSX.Element | null {
  const sources = usePluginTaskSources()
  const select = usePluginTaskSourceSelection((s) => s.select)
  if (sources.length === 0) {
    return null
  }
  return (
    <>
      {sources.map((source) => {
        const Icon = resolvePluginPanelIcon(source.icon)
        const active = activeKey === source.key
        return (
          <Tooltip key={source.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => select(source.key)}
                data-task-source={source.key}
                aria-label={source.title}
                aria-pressed={active}
                className={cn(
                  'group flex h-8 w-8 items-center justify-center rounded-md border transition',
                  active
                    ? 'border-foreground/40 bg-muted/70 text-foreground shadow-sm'
                    : 'border-border/40 bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                )}
              >
                <Icon className="size-3.5" />
              </button>
            </TooltipTrigger>
            {/* Why: plugin-provided titles render untranslated by design. */}
            <TooltipContent side="bottom" sideOffset={6}>
              {source.title}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </>
  )
}
