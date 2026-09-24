import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import { buildWorkspaceOpenInTargets } from './workspace-open-in-targets'

function member(id: string, repoId: string, path: string, displayName = 'login'): Worktree {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only id, repoId, path and displayName; a full Worktree adds no coverage.
  return { id, repoId, path, displayName } as Worktree
}

const repos = [
  { id: 'repo-a', displayName: 'discovery_bff' },
  { id: 'repo-b', displayName: 'gohotsearch' }
]

describe('buildWorkspaceOpenInTargets', () => {
  it('offers only the workspace itself when it has no members', () => {
    expect(
      buildWorkspaceOpenInTargets({
        worktreePath: '/ws/feature',
        rootLabel: 'Workspace root',
        memberWorktrees: [],
        repos
      })
    ).toEqual([
      { id: 'workspace-root', label: 'Workspace root', path: '/ws/feature', isRoot: true }
    ])
  })

  it('puts the container first, then one entry per member', () => {
    const targets = buildWorkspaceOpenInTargets({
      worktreePath: '/ws/test123',
      rootLabel: 'Workspace root',
      memberWorktrees: [
        member('w1', 'repo-a', '/ws/test123/discovery_bff'),
        member('w2', 'repo-b', '/ws/test123/gohotsearch')
      ],
      repos
    })

    expect(targets.map((target) => target.path)).toEqual([
      '/ws/test123',
      '/ws/test123/discovery_bff',
      '/ws/test123/gohotsearch'
    ])
    expect(targets.filter((target) => target.isRoot)).toHaveLength(1)
  })

  it('names members by repository, not by the workspace name they all share', () => {
    // Why this matters: every member's displayName is the workspace name, so using it would make
    // the picker read as several identical rows.
    const targets = buildWorkspaceOpenInTargets({
      worktreePath: '/ws/test123',
      rootLabel: 'Workspace root',
      memberWorktrees: [
        member('w1', 'repo-a', '/ws/test123/discovery_bff', 'test123'),
        member('w2', 'repo-b', '/ws/test123/gohotsearch', 'test123')
      ],
      repos
    })

    expect(targets.slice(1).map((target) => target.label)).toEqual(['discovery_bff', 'gohotsearch'])
  })

  it('falls back to the worktree name when its repo is no longer registered', () => {
    const targets = buildWorkspaceOpenInTargets({
      worktreePath: '/ws/test123',
      rootLabel: 'Workspace root',
      memberWorktrees: [member('w1', 'gone', '/ws/test123/mystery', 'mystery')],
      repos
    })

    expect(targets[1].label).toBe('mystery')
  })
})
