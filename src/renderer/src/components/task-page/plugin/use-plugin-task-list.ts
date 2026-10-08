import { useCallback, useEffect, useRef, useState } from 'react'
import type { PluginTaskItem } from '../../../../../shared/plugins/plugin-task-provider'
import type { ActivePluginTaskSource } from '@/store/plugin-task-sources'
import { formatPluginTaskError, listPluginTasks } from '@/lib/plugin-task-source-client'

// Why: plugin list commands can shell out (seconds per call); revisiting a
// view shows the last result immediately while a refresh runs.
const listCache = new Map<string, PluginTaskItem[]>()

export type PluginTaskListState = {
  items: PluginTaskItem[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePluginTaskList(
  source: ActivePluginTaskSource,
  view: string | null
): PluginTaskListState {
  const cacheKey = `${source.key}\u0000${view ?? ''}`
  const [items, setItems] = useState<PluginTaskItem[]>(() => listCache.get(cacheKey) ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const generationRef = useRef(0)
  // Why: `source` identity changes on every plugin-list refresh; refetch only
  // when the provider/view key changes, reading the latest source from a ref.
  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => {
    const generation = ++generationRef.current
    setItems(listCache.get(cacheKey) ?? [])
    setError(null)
    setLoading(true)
    listPluginTasks(sourceRef.current, view)
      .then((result) => {
        if (generation !== generationRef.current) {
          return
        }
        listCache.set(cacheKey, result.items)
        setItems(result.items)
      })
      .catch((caught: unknown) => {
        if (generation === generationRef.current) {
          setError(formatPluginTaskError(caught))
        }
      })
      .finally(() => {
        if (generation === generationRef.current) {
          setLoading(false)
        }
      })
  }, [cacheKey, view, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  return { items, loading, error, reload }
}
