import { useCallback, useMemo, useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import type { PluginTaskItem } from '../../../../../shared/plugins/plugin-task-provider'
import {
  usePluginTaskSourceSelection,
  type ActivePluginTaskSource
} from '@/store/plugin-task-sources'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { usePluginTaskList } from './use-plugin-task-list'
import { filterPluginTaskItems, getPluginTaskWorkspaceName } from './plugin-task-items'
import { PluginTaskRow } from './PluginTaskRow'
import { PluginTaskDetailSheet } from './PluginTaskDetailSheet'

export function TaskPagePluginContent({
  source,
  pending
}: {
  source: ActivePluginTaskSource | null
  pending: boolean
}): React.JSX.Element | null {
  if (!source) {
    return pending ? (
      <div className="mt-4 flex items-center justify-center py-14">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </div>
    ) : null
  }
  // Why: keyed so view/search state resets when switching plugin sources.
  return <PluginTaskSourceList key={source.key} source={source} />
}

function PluginTaskSourceList({ source }: { source: ActivePluginTaskSource }): React.JSX.Element {
  const [view, setView] = useState<string | null>(source.views[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const { items, loading, error, reload } = usePluginTaskList(source, view)
  const visibleItems = useMemo(() => filterPluginTaskItems(items, query), [items, query])
  const openItem = usePluginTaskSourceSelection((s) => s.openItem)
  const setOpenItem = usePluginTaskSourceSelection((s) => s.setOpenItem)
  const openModal = useAppStore((s) => s.openModal)

  const startWorkspace = useCallback(
    (item: PluginTaskItem) => {
      setOpenItem(null)
      openModal('new-workspace-composer', {
        prefilledName: getPluginTaskWorkspaceName(item),
        telemetrySource: 'sidebar'
      })
    },
    [openModal, setOpenItem]
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {source.views.length > 0 ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={view ?? ''}
            onValueChange={(next) => {
              if (next) {
                setView(next)
              }
            }}
          >
            {source.views.map((candidate) => (
              <ToggleGroupItem key={candidate.id} value={candidate.id}>
                {candidate.title}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <div className="min-w-[180px] max-w-sm flex-1">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate(
              'auto.components.TaskPage.pluginTaskFilterPlaceholder',
              'Filter tasks'
            )}
            aria-label={translate(
              'auto.components.TaskPage.pluginTaskFilterPlaceholder',
              'Filter tasks'
            )}
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={reload}
              disabled={loading}
              aria-label={translate('auto.components.TaskPage.pluginTaskRefresh', 'Refresh')}
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPage.pluginTaskRefresh', 'Refresh')}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-3 flex min-h-0 max-h-full flex-col overflow-hidden rounded-md border border-border/50 bg-background shadow-sm">
        <div className="flex h-10 flex-none items-center justify-between gap-3 border-b border-border/50 bg-muted/35 px-3">
          {/* Why: titles come from the plugin manifest, so they render untranslated by design. */}
          <div className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {source.title}
          </div>
          <div className="shrink-0 text-[11px] text-muted-foreground">
            {visibleItems.length} {translate('auto.components.TaskPage.b7bae28b6a', 'shown')}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek"
          style={{ scrollbarGutter: 'stable' }}
        >
          {error ? (
            <div className="border-b border-border px-4 py-3 text-sm text-destructive">{error}</div>
          ) : null}

          {loading && items.length === 0 ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-3 py-3">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted/70" />
                  <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-muted/60" />
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && visibleItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {query
                ? translate(
                    'auto.components.TaskPage.pluginTaskNoMatches',
                    'No tasks match the filter.'
                  )
                : translate('auto.components.TaskPage.pluginTaskEmpty', 'No tasks found.')}
            </div>
          ) : null}

          <div className="divide-y divide-border/50">
            {visibleItems.map((item) => (
              <PluginTaskRow
                key={item.id}
                item={item}
                selected={openItem?.id === item.id}
                onOpen={setOpenItem}
                onStartWorkspace={startWorkspace}
              />
            ))}
          </div>
        </div>
      </div>

      <PluginTaskDetailSheet
        source={source}
        item={openItem}
        onClose={() => setOpenItem(null)}
        onStartWorkspace={startWorkspace}
      />
    </>
  )
}
