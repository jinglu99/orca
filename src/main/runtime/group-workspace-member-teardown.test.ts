import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceKey } from '../../shared/folder-workspace-types'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import {
  listGroupWorkspaceMemberWorktreeIds,
  removeGroupWorkspaceMembers
} from './group-workspace-member-teardown'

function lineage(
  childWorkspaceKey: WorkspaceKey,
  parentWorkspaceKey: WorkspaceKey
): WorkspaceLineage {
  return {
    childWorkspaceKey,
    parentWorkspaceKey,
    origin: 'manual',
    capture: { source: 'manual-action', confidence: 'explicit' },
    createdAt: 1
  }
}

describe('listGroupWorkspaceMemberWorktreeIds', () => {
  it('returns only the worktrees attached to this folder workspace', () => {
    const rows = {
      a: lineage('worktree:repo-a::/ws/login/api', 'folder:ws-1'),
      b: lineage('worktree:repo-b::/ws/login/web', 'folder:ws-1'),
      c: lineage('worktree:repo-c::/ws/other/api', 'folder:ws-2'),
      d: lineage('folder:nested', 'folder:ws-1')
    }
    expect(listGroupWorkspaceMemberWorktreeIds(rows, 'ws-1')).toEqual([
      'repo-a::/ws/login/api',
      'repo-b::/ws/login/web'
    ])
  })

  it('returns nothing when the workspace has no attached worktrees', () => {
    expect(listGroupWorkspaceMemberWorktreeIds({}, 'ws-1')).toEqual([])
  })
})

describe('removeGroupWorkspaceMembers', () => {
  it('removes every member in order and reports success', async () => {
    const seen: string[] = []
    const removeWorktree = vi.fn(async (worktreeId: string) => {
      seen.push(worktreeId)
      return {}
    })

    const teardown = await removeGroupWorkspaceMembers({
      worktreeIds: ['a', 'b', 'c'],
      removeWorktree
    })

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(teardown.allRemoved).toBe(true)
    expect(teardown.preservedBranches).toEqual([])
  })

  it('gathers preserved branches across member repos', async () => {
    const teardown = await removeGroupWorkspaceMembers({
      worktreeIds: ['a', 'b'],
      removeWorktree: async (worktreeId) =>
        worktreeId === 'a' ? { preservedBranch: { branchName: 'feat/login' } } : {}
    })

    expect(teardown.allRemoved).toBe(true)
    expect(teardown.preservedBranches).toEqual([
      { worktreeId: 'a', branch: { branchName: 'feat/login' } }
    ])
  })

  it('keeps going after a member fails and reports the batch as incomplete', async () => {
    // Why this matters: the caller leaves the container directory in place when a member is still
    // on disk, so a thrown-through failure would orphan that checkout instead.
    const teardown = await removeGroupWorkspaceMembers({
      worktreeIds: ['a', 'b', 'c'],
      removeWorktree: async (worktreeId) => {
        if (worktreeId === 'b') {
          throw new Error('worktree is locked')
        }
        return {}
      }
    })

    expect(teardown.allRemoved).toBe(false)
    expect(teardown.removals).toEqual([
      { worktreeId: 'a', status: 'removed' },
      { worktreeId: 'b', status: 'failed', error: 'worktree is locked' },
      { worktreeId: 'c', status: 'removed' }
    ])
  })
})
