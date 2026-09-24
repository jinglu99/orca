import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateWorktreeResult } from '../../../../shared/worktree/create-types'
import type { WorktreeSlice } from '@/store/slices/worktree-helpers'

type CreateWorktreeFn = WorktreeSlice['createWorktree']

const toastWarning = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { warning: toastWarning } }))

import { createGroupWorkspaceMemberWorktrees } from './group-workspace-member-fanout'

function makeWorkspace(layout?: FolderWorkspace['layout']): FolderWorkspace {
  return {
    id: 'ws-1',
    projectGroupId: 'group-1',
    name: 'login',
    folderPath: '/workspaces/platform/login',
    ...(layout ? { layout } : {}),
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
}

function makeRepo(id: string, path: string): Repo {
  return { id, path, displayName: id, badgeColor: '#000', addedAt: 0, kind: 'git' }
}

const repos = [makeRepo('repo-a', '/src/platform/api'), makeRepo('repo-b', '/src/platform/web')]

function makeResult(path: string, staleLocalBranch?: string): CreateWorktreeResult {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fan-out reads only id, path and localBaseRefRefresh off the result; a full Worktree adds no coverage.
  return {
    worktree: { id: `id::${path}`, path },
    ...(staleLocalBranch
      ? { localBaseRefRefresh: { status: 'blocked', localBranch: staleLocalBranch } }
      : {})
  } as CreateWorktreeResult
}

describe('createGroupWorkspaceMemberWorktrees', () => {
  beforeEach(() => {
    toastWarning.mockClear()
  })

  it('creates one worktree per repo inside the container, attached to the workspace', async () => {
    const createWorktree = vi.fn<CreateWorktreeFn>(async (...args) =>
      makeResult(String(args[25]?.worktreePathOverride))
    )

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      createWorktree
    })

    expect(createWorktree).toHaveBeenCalledTimes(2)
    expect(createWorktree.mock.calls.map((call) => call[25])).toEqual([
      {
        parentFolderWorkspaceId: 'ws-1',
        worktreePathOverride: '/workspaces/platform/login/api',
        suppressCreateNotices: true
      },
      {
        parentFolderWorkspaceId: 'ws-1',
        worktreePathOverride: '/workspaces/platform/login/web',
        suppressCreateNotices: true
      }
    ])
    // Every member shares the workspace name, so each derives the same branch from it.
    expect(createWorktree.mock.calls.map((call) => call[1])).toEqual(['login', 'login'])
    expect(toastWarning).not.toHaveBeenCalled()
  })

  it('does nothing for a shared-parent workspace', async () => {
    // Why: that folderPath is the group's real source folder, not a container to fill.
    const createWorktree = vi.fn<CreateWorktreeFn>()

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace(),
      memberRepos: repos,
      createWorktree
    })

    expect(createWorktree).not.toHaveBeenCalled()
  })

  it('does nothing when the group has no git repos', async () => {
    const createWorktree = vi.fn<CreateWorktreeFn>()

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: [],
      createWorktree
    })

    expect(createWorktree).not.toHaveBeenCalled()
  })

  it('keeps the repos that succeeded and reports the one that failed', async () => {
    const createWorktree = vi.fn<CreateWorktreeFn>(async (repoId) => {
      if (repoId === 'repo-b') {
        throw new Error('base ref missing')
      }
      return makeResult('/workspaces/platform/login/api')
    })

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      createWorktree
    })

    expect(createWorktree).toHaveBeenCalledTimes(2)
    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastWarning.mock.calls[0][0]).toContain('1 of 2')
    expect(toastWarning.mock.calls[0][1]).toMatchObject({
      description: 'repo-b: base ref missing'
    })
  })
})

describe('createGroupWorkspaceMemberWorktrees base-ref notices', () => {
  beforeEach(() => {
    toastWarning.mockClear()
  })

  it('suppresses the per-create notice and reports the stale bases once', async () => {
    // Why this matters: the per-create notice is sticky and keyed per worktree, so without
    // suppression a 49-repo group stacks 49 identical warnings on screen.
    const createWorktree = vi.fn<CreateWorktreeFn>(async (repoId, ...rest) =>
      makeResult(String(rest[24]?.worktreePathOverride), repoId === 'repo-a' ? 'master' : undefined)
    )

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      createWorktree
    })

    expect(createWorktree.mock.calls.every((call) => call[25]?.suppressCreateNotices)).toBe(true)
    expect(toastWarning).toHaveBeenCalledTimes(1)
    expect(toastWarning.mock.calls[0][0]).toContain('1 repositories')
    expect(toastWarning.mock.calls[0][1]).toMatchObject({
      description: expect.stringContaining('repo-a (master)')
    })
  })

  it('stays silent when every member refreshed its local base', async () => {
    const createWorktree = vi.fn<CreateWorktreeFn>(async (...args) =>
      makeResult(String(args[25]?.worktreePathOverride))
    )

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      createWorktree
    })

    expect(toastWarning).not.toHaveBeenCalled()
  })
})

describe('createGroupWorkspaceMemberWorktrees base fetch policy', () => {
  it('fetches each repo first by default, like a single-repo create', async () => {
    // Why the default matters: skipping the fetch silently branches members from whatever the
    // last fetch left on disk, which is a correctness trade the user has to opt into.
    const createWorktree = vi.fn<CreateWorktreeFn>(async (...args) =>
      makeResult(String(args[25]?.worktreePathOverride))
    )

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      createWorktree
    })

    expect(createWorktree.mock.calls.every((call) => call[25]?.baseRefRefresh === undefined)).toBe(
      true
    )
  })

  it('branches from the on-disk base ref when the composer opted out', async () => {
    const createWorktree = vi.fn<CreateWorktreeFn>(async (...args) =>
      makeResult(String(args[25]?.worktreePathOverride))
    )

    await createGroupWorkspaceMemberWorktrees({
      workspace: makeWorkspace('isolated-container'),
      memberRepos: repos,
      skipBaseFetch: true,
      createWorktree
    })

    expect(
      createWorktree.mock.calls.every((call) => call[25]?.baseRefRefresh === 'background')
    ).toBe(true)
  })
})
