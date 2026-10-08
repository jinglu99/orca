import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { PluginHostListEntry, PluginHostTaskProvider } from '../../../preload/api-types'
import {
  pluginTaskSourceKey,
  type PluginTaskItem
} from '../../../shared/plugins/plugin-task-provider'
import { ensurePluginPanelsLoaded, usePluginPanelsStore } from './plugin-panels'

/** A task provider contributed by an enabled plugin, flattened for the Tasks page. */
export type ActivePluginTaskSource = PluginHostTaskProvider & {
  key: string
  pluginKey: string
  pluginName: string
}

export function collectActivePluginTaskSources(
  plugins: readonly PluginHostListEntry[]
): ActivePluginTaskSource[] {
  return plugins
    .filter(
      (plugin) =>
        plugin.status === 'running' || plugin.status === 'restarting' || plugin.status === 'idle'
    )
    .flatMap((plugin) =>
      (plugin.taskProviders ?? []).map((provider) => ({
        ...provider,
        key: pluginTaskSourceKey(plugin.pluginKey, provider.id),
        pluginKey: plugin.pluginKey,
        pluginName: plugin.name
      }))
    )
}

export function usePluginTaskSources(): ActivePluginTaskSource[] {
  const plugins = usePluginPanelsStore((s) => s.plugins)
  useEffect(() => {
    ensurePluginPanelsLoaded()
  }, [])
  return useMemo(() => collectActivePluginTaskSources(plugins), [plugins])
}

const SELECTED_SOURCE_STORAGE_KEY = 'orca.tasks.pluginTaskSource'

function readStoredSelection(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_SOURCE_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredSelection(key: string | null): void {
  try {
    if (key) {
      window.localStorage.setItem(SELECTED_SOURCE_STORAGE_KEY, key)
    } else {
      window.localStorage.removeItem(SELECTED_SOURCE_STORAGE_KEY)
    }
  } catch {
    // Storage is a convenience; selection still works for this session.
  }
}

type PluginTaskSourceSelectionState = {
  /** Selected plugin source key; null means a built-in provider is active. */
  selectedKey: string | null
  openItem: PluginTaskItem | null
  select: (key: string | null) => void
  setOpenItem: (item: PluginTaskItem | null) => void
}

// Why: kept apart from settings.defaultTaskSource, whose closed provider enum is
// validated by main and RPC; plugin sources come and go with plugin installs.
export const usePluginTaskSourceSelection = create<PluginTaskSourceSelectionState>()((set) => ({
  selectedKey: readStoredSelection(),
  openItem: null,
  select: (key) => {
    writeStoredSelection(key)
    set({ selectedKey: key, openItem: null })
  },
  setOpenItem: (item) => set({ openItem: item })
}))

/** The selected plugin source, or null when none is selected or it is no longer
 *  contributed. `pending` while the plugin list has not loaded yet. */
export function useActivePluginTaskSource(): {
  source: ActivePluginTaskSource | null
  pending: boolean
} {
  const sources = usePluginTaskSources()
  const selectedKey = usePluginTaskSourceSelection((s) => s.selectedKey)
  const fetchStatus = usePluginPanelsStore((s) => s.fetchStatus)
  return useMemo(() => {
    if (!selectedKey) {
      return { source: null, pending: false }
    }
    const source = sources.find((candidate) => candidate.key === selectedKey) ?? null
    const pending = !source && (fetchStatus === 'idle' || fetchStatus === 'loading')
    return { source, pending }
  }, [fetchStatus, selectedKey, sources])
}
