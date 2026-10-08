import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, LoaderCircle, X } from 'lucide-react'
import { VisuallyHidden } from 'radix-ui'
import type {
  PluginTaskDetailResult,
  PluginTaskItem
} from '../../../../../shared/plugins/plugin-task-provider'
import type { ActivePluginTaskSource } from '@/store/plugin-task-sources'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { formatPluginTaskError, getPluginTaskDetail } from '@/lib/plugin-task-source-client'
import { PluginTaskStatusBadge, formatPluginTaskUpdatedAt } from './PluginTaskRow'

export function PluginTaskDetailSheet({
  source,
  item,
  onClose,
  onStartWorkspace
}: {
  source: ActivePluginTaskSource
  item: PluginTaskItem | null
  onClose: () => void
  onStartWorkspace: (item: PluginTaskItem) => void
}): React.JSX.Element {
  const [detail, setDetail] = useState<PluginTaskDetailResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const itemId = item?.id ?? null
  const detailCommand = source.detailCommand
  // Why: refetch per item/command, not on every plugin-list refresh of `source`.
  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => {
    setDetail(null)
    setError(null)
    if (!itemId || !detailCommand) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getPluginTaskDetail(sourceRef.current, itemId)
      .then((result) => {
        if (!cancelled) {
          setDetail(result)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(formatPluginTaskError(caught))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [itemId, detailCommand])

  const displayed = detail?.item ?? item
  const updatedAt = formatPluginTaskUpdatedAt(displayed?.updatedAt)

  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(92vw,720px)] sm:max-w-[720px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <VisuallyHidden.Root asChild>
          <SheetTitle>{displayed?.title ?? source.title}</SheetTitle>
        </VisuallyHidden.Root>
        <VisuallyHidden.Root asChild>
          <SheetDescription>
            {translate(
              'auto.components.TaskPage.pluginTaskDetailDescription',
              'Preview and start work from the selected task.'
            )}
          </SheetDescription>
        </VisuallyHidden.Root>

        {displayed ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex-none border-b border-border/50 bg-muted/30 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono">{displayed.key ?? displayed.id}</span>
                    {displayed.project ? <span>{displayed.project}</span> : null}
                    {updatedAt ? <span>{updatedAt}</span> : null}
                    {loading ? <LoaderCircle className="size-3 animate-spin" /> : null}
                  </div>
                  <h2 className="mt-1 text-[20px] font-semibold leading-tight text-foreground">
                    {displayed.title}
                  </h2>
                  {displayed.status || displayed.labels?.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {displayed.status ? (
                        <PluginTaskStatusBadge status={displayed.status} />
                      ) : null}
                      {displayed.labels?.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-border/50 bg-muted/35 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  onClick={() => onStartWorkspace(displayed)}
                  className="hidden shrink-0 sm:inline-flex"
                  size="sm"
                >
                  {translate('auto.components.TaskPage.9497f2787c', 'Start workspace')}
                  <ArrowRight className="size-4" />
                </Button>
                {displayed.url ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={() => {
                          if (displayed.url) {
                            void window.api.shell.openUrl(displayed.url)
                          }
                        }}
                        aria-label={translate(
                          'auto.components.TaskPage.pluginTaskOpenInBrowser',
                          'Open in browser'
                        )}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      {translate(
                        'auto.components.TaskPage.pluginTaskOpenInBrowser',
                        'Open in browser'
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={onClose}
                      aria-label={translate(
                        'auto.components.TaskPage.pluginTaskCloseDetail',
                        'Close task preview'
                      )}
                    >
                      <X className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {translate('auto.components.JiraIssueWorkspace.7a96985ca0', 'Close')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-sleek">
              {error ? (
                <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              {detail?.fields?.length ? (
                <dl className="grid grid-cols-[minmax(96px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  {detail.fields.map((field) => (
                    <div key={`${field.label}\u0000${field.value}`} className="contents">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        {field.url ? (
                          <button
                            type="button"
                            className="text-left text-primary underline-offset-4 hover:underline"
                            onClick={() => {
                              if (field.url) {
                                void window.api.shell.openUrl(field.url)
                              }
                            }}
                          >
                            {field.value || field.url}
                          </button>
                        ) : (
                          field.value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {detail?.description ? (
                <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">
                  {detail.description}
                </p>
              ) : null}
              {!loading && !error && !detail?.fields?.length && !detail?.description ? (
                <p className="text-sm text-muted-foreground">
                  {translate(
                    'auto.components.TaskPage.pluginTaskNoDetails',
                    'No additional details.'
                  )}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
