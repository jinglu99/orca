import { describe, expect, it } from 'vitest'
import type { PluginHostListEntry } from '../../../../../preload/api-types'
import { collectActivePluginTaskSources } from '@/store/plugin-task-sources'
import { filterPluginTaskItems, getPluginTaskWorkspaceName } from './plugin-task-items'

function plugin(overrides: Partial<PluginHostListEntry>): PluginHostListEntry {
  return {
    pluginKey: 'acme.tasks',
    consentFingerprint: null,
    name: 'Acme Tasks',
    version: '1.0.0',
    publisher: 'acme',
    status: 'idle',
    needsReconsent: false,
    isDev: false,
    official: false,
    bundled: false,
    capabilities: [],
    panels: [],
    commands: [],
    hasWorker: true,
    restarts: 0,
    taskProviders: [{ id: 'tracker', title: 'Tracker', listCommand: 'tasks.list', views: [] }],
    ...overrides
  }
}

describe('collectActivePluginTaskSources', () => {
  it('keys sources by plugin and provider for enabled plugins only', () => {
    const sources = collectActivePluginTaskSources([
      plugin({}),
      plugin({ pluginKey: 'acme.pending', status: 'pending' }),
      plugin({ pluginKey: 'acme.disabled', status: 'disabled' })
    ])
    expect(sources.map((source) => source.key)).toEqual(['acme.tasks/tracker'])
    expect(sources[0]).toMatchObject({ pluginKey: 'acme.tasks', pluginName: 'Acme Tasks' })
  })

  it('tolerates hosts that predate task providers', () => {
    expect(collectActivePluginTaskSources([plugin({ taskProviders: undefined })])).toEqual([])
  })
})

describe('plugin task items', () => {
  const items = [
    { id: 'p:1', key: '1', title: 'Fix login', project: 'Web', labels: ['P0'] },
    { id: 'p:2', key: '2', title: '热点频道下线', status: { label: '进行中' } }
  ]

  it('filters by title, key, project, status, and labels', () => {
    expect(filterPluginTaskItems(items, 'login').map((item) => item.id)).toEqual(['p:1'])
    expect(filterPluginTaskItems(items, 'p0').map((item) => item.id)).toEqual(['p:1'])
    expect(filterPluginTaskItems(items, '进行').map((item) => item.id)).toEqual(['p:2'])
    expect(filterPluginTaskItems(items, '  ')).toHaveLength(2)
  })

  it('names the workspace after the task title, keeping non-Latin text', () => {
    expect(getPluginTaskWorkspaceName(items[0]!)).toBe('Fix login')
    expect(getPluginTaskWorkspaceName(items[1]!)).toBe('热点频道下线')
    expect(getPluginTaskWorkspaceName({ ...items[1]!, workspaceName: 'custom' })).toBe('custom')
    expect(getPluginTaskWorkspaceName({ ...items[0]!, title: 'x'.repeat(200) })).toHaveLength(80)
  })
})
