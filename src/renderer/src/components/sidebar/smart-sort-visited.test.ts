import { describe, expect, it } from 'vitest'
import type { Worktree } from '../../../../shared/worktree/types'
import { composeWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { buildWorktreeComparator } from './smart-sort'

const NOW = 1_000_000_000

function makeWorktree(overrides: Partial<Worktree> & { id: string }): Worktree {
  return {
    repoId: 'repo-1',
    path: `/tmp/${overrides.id}`,
    branch: `refs/heads/${overrides.id}`,
    head: 'abc123',
    isBare: false,
    isMainWorktree: false,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    comment: '',
    isUnread: false,
    isPinned: false,
    displayName: overrides.id,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}

function sortVisited(
  worktrees: Worktree[],
  lastVisitedAtByWorktreeId: Record<string, number>
): string[] {
  return [...worktrees]
    .sort(
      buildWorktreeComparator(
        'visited',
        new Map(),
        NOW,
        new Map(),
        undefined,
        lastVisitedAtByWorktreeId
      )
    )
    .map((w) => w.id)
}

describe('buildWorktreeComparator — visited (recently used)', () => {
  it('puts the most recently visited workspace first, regardless of repo', () => {
    const a = makeWorktree({ id: 'a', repoId: 'repo-1' })
    const b = makeWorktree({ id: 'b', repoId: 'repo-2' })
    const c = makeWorktree({ id: 'c', repoId: 'repo-1' })

    expect(sortVisited([a, b, c], { a: 100, b: 300, c: 200 })).toEqual(['b', 'c', 'a'])
  })

  it('ranks visits above background activity, then falls back to activity for unvisited rows', () => {
    const visited = makeWorktree({ id: 'visited', lastActivityAt: 10 })
    const busy = makeWorktree({ id: 'busy', lastActivityAt: 9_000 })
    const quiet = makeWorktree({ id: 'quiet', lastActivityAt: 5_000 })

    expect(sortVisited([quiet, busy, visited], { visited: 50 })).toEqual([
      'visited',
      'busy',
      'quiet'
    ])
  })

  it('reads host-qualified visit keys before legacy bare ids', () => {
    const remote = makeWorktree({ id: 'wt', hostId: 'ssh:box' })
    const local = makeWorktree({ id: 'other' })

    const visits = { other: 200, [composeWorktreeHostIdentity('ssh:box', 'wt')]: 300, wt: 1 }

    expect(sortVisited([local, remote], visits)).toEqual(['wt', 'other'])
  })
})
