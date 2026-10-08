import { describe, expect, it } from 'vitest'
import { parsePluginManifest } from './plugin-manifest'
import { pluginTaskDetailResultSchema, pluginTaskListResultSchema } from './plugin-task-provider'

function manifestWith(contributes: Record<string, unknown>): Record<string, unknown> {
  return {
    manifestVersion: 1,
    id: 'tasks',
    publisher: 'acme',
    name: 'Tasks',
    version: '1.0.0',
    engines: { orca: '>=1.0.0' },
    pluginApi: 1,
    main: 'main.mjs',
    contributes
  }
}

const listCommands = [
  { id: 'tasks.list', title: 'List' },
  { id: 'tasks.detail', title: 'Detail' }
]

describe('plugin task provider manifest contribution', () => {
  it('accepts a provider whose commands are declared worker commands', () => {
    const result = parsePluginManifest(
      manifestWith({
        commands: listCommands,
        taskProviders: [
          {
            id: 'tracker',
            title: 'Tracker',
            listCommand: 'tasks.list',
            detailCommand: 'tasks.detail',
            views: [{ id: 'mine', title: 'Mine' }]
          }
        ]
      })
    )
    expect(result.ok).toBe(true)
    expect(result.ok && result.manifest.contributes.taskProviders[0]?.views).toEqual([
      { id: 'mine', title: 'Mine' }
    ])
  })

  it('defaults taskProviders and views to empty lists', () => {
    const empty = parsePluginManifest(manifestWith({ commands: listCommands }))
    expect(empty.ok && empty.manifest.contributes.taskProviders).toEqual([])
    const noViews = parsePluginManifest(
      manifestWith({
        commands: listCommands,
        taskProviders: [{ id: 'tracker', title: 'Tracker', listCommand: 'tasks.list' }]
      })
    )
    expect(noViews.ok && noViews.manifest.contributes.taskProviders[0]?.views).toEqual([])
  })

  it('rejects a list command that is not a declared worker command', () => {
    const result = parsePluginManifest(
      manifestWith({
        commands: [{ id: 'tasks.alias', title: 'Alias', action: 'tasks.open' }],
        taskProviders: [{ id: 'tracker', title: 'Tracker', listCommand: 'tasks.alias' }]
      })
    )
    expect(result.ok).toBe(false)
  })

  it('rejects an undeclared detail command', () => {
    const result = parsePluginManifest(
      manifestWith({
        commands: listCommands,
        taskProviders: [
          { id: 'tracker', title: 'Tracker', listCommand: 'tasks.list', detailCommand: 'nope' }
        ]
      })
    )
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/detailCommand/)
  })

  it('rejects duplicate provider and view ids', () => {
    const duplicateProviders = parsePluginManifest(
      manifestWith({
        commands: listCommands,
        taskProviders: [
          { id: 'tracker', title: 'A', listCommand: 'tasks.list' },
          { id: 'tracker', title: 'B', listCommand: 'tasks.list' }
        ]
      })
    )
    expect(duplicateProviders.ok).toBe(false)
    const duplicateViews = parsePluginManifest(
      manifestWith({
        commands: listCommands,
        taskProviders: [
          {
            id: 'tracker',
            title: 'A',
            listCommand: 'tasks.list',
            views: [
              { id: 'mine', title: 'Mine' },
              { id: 'mine', title: 'Again' }
            ]
          }
        ]
      })
    )
    expect(duplicateViews.ok).toBe(false)
  })
})

describe('plugin task results', () => {
  it('rejects non-http item links so plugins cannot hand the shell other schemes', () => {
    const result = pluginTaskListResultSchema.safeParse({
      items: [{ id: '1', title: 'Task', url: 'file:///etc/passwd' }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown status tones and non-http field links', () => {
    expect(
      pluginTaskListResultSchema.safeParse({
        items: [{ id: '1', title: 'Task', status: { label: 'Open', tone: 'purple' } }]
      }).success
    ).toBe(false)
    expect(
      pluginTaskDetailResultSchema.safeParse({
        item: { id: '1', title: 'Task' },
        fields: [{ label: 'Doc', value: 'x', url: 'javascript:alert(1)' }]
      }).success
    ).toBe(false)
  })
})
