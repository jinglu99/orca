import { describe, expect, it, vi } from 'vitest'
import { RuntimeProjectGroupController } from './runtime-project-group-controller'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'

const workspace = {
  id: 'ws-1',
  projectGroupId: 'group-1',
  folderPath: '/tmp/ws'
} as FolderWorkspace

function createController(
  resolveFolderConnectionId: (workspace: FolderWorkspace) => string | null,
  overrides: {
    workspace?: FolderWorkspace
    workspaceLineage?: Record<string, unknown>
  } = {}
) {
  const activeWorkspace = overrides.workspace ?? workspace
  const removeFolderWorkspace = vi.fn(() => true)
  const teardownFolderWorkspacePtys = vi.fn(async () => undefined)
  const cleanupRemovedFolderWorkspaceState = vi.fn()
  const notifyReposChanged = vi.fn()
  const removeMemberWorktree = vi.fn(async (_worktreeId: string) => ({}))
  const storeStub = {
    getFolderWorkspaces: () => [activeWorkspace],
    getAllWorkspaceLineage: () => overrides.workspaceLineage ?? {},
    removeFolderWorkspace
  }
  const controller = new RuntimeProjectGroupController({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: RuntimeStore is a large host interface and deleteFolderWorkspace reads only the three members stubbed here.
    getStore: () => storeStub as never,
    resolveRepo: async () => {
      throw new Error('unused')
    },
    notifyReposChanged,
    resolveFolderConnectionId,
    teardownFolderWorkspacePtys,
    cleanupRemovedFolderWorkspaceState,
    removeMemberWorktree
  })
  return {
    controller,
    removeFolderWorkspace,
    teardownFolderWorkspacePtys,
    cleanupRemovedFolderWorkspaceState,
    notifyReposChanged,
    removeMemberWorktree
  }
}

describe('RuntimeProjectGroupController.deleteFolderWorkspace', () => {
  it('tears down PTYs and runtime state before removing the catalog row', async () => {
    const deps = createController(() => 'ssh-1')

    await expect(deps.controller.deleteFolderWorkspace('ws-1')).resolves.toEqual({ deleted: true })

    expect(deps.teardownFolderWorkspacePtys).toHaveBeenCalledWith('folder:ws-1', 'ssh-1')
    expect(deps.cleanupRemovedFolderWorkspaceState).toHaveBeenCalledWith('folder:ws-1')
    expect(deps.teardownFolderWorkspacePtys.mock.invocationCallOrder[0]).toBeLessThan(
      deps.removeFolderWorkspace.mock.invocationCallOrder[0]!
    )
    expect(deps.notifyReposChanged).toHaveBeenCalledTimes(1)
  })

  it('still deletes when the folder host is ambiguous, skipping only the PTY sweep', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const deps = createController(() => {
      throw new Error('folder_workspace_connection_ambiguous')
    })

    await expect(deps.controller.deleteFolderWorkspace('ws-1')).resolves.toEqual({ deleted: true })

    expect(deps.teardownFolderWorkspacePtys).not.toHaveBeenCalled()
    expect(deps.cleanupRemovedFolderWorkspaceState).toHaveBeenCalledWith('folder:ws-1')
    expect(deps.removeFolderWorkspace).toHaveBeenCalledWith('ws-1')
    warn.mockRestore()
  })
})

describe('RuntimeProjectGroupController.deleteFolderWorkspace member cascade', () => {
  const containerWorkspace: FolderWorkspace = {
    id: 'ws-1',
    projectGroupId: 'group-1',
    name: 'login',
    folderPath: '/tmp/ws',
    layout: 'isolated-container',
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

  const memberLineage = {
    a: {
      childWorkspaceKey: 'worktree:repo-a::/tmp/ws/api',
      parentWorkspaceKey: 'folder:ws-1'
    },
    b: {
      childWorkspaceKey: 'worktree:repo-b::/tmp/ws/web',
      parentWorkspaceKey: 'folder:ws-1'
    }
  }

  it('removes every member checkout of an isolated container', async () => {
    const deps = createController(() => null, {
      workspace: containerWorkspace,
      workspaceLineage: memberLineage
    })

    const result = await deps.controller.deleteFolderWorkspace('ws-1')

    expect(deps.removeMemberWorktree.mock.calls.map((call) => call[0])).toEqual([
      'repo-a::/tmp/ws/api',
      'repo-b::/tmp/ws/web'
    ])
    expect(result.memberTeardown?.allRemoved).toBe(true)
    expect(deps.removeFolderWorkspace).toHaveBeenCalledWith('ws-1')
  })

  it('never touches checkouts or disk for a shared-parent workspace', async () => {
    // Why this is the load-bearing test: a shared-parent folderPath is the user's own source
    // folder, so a cascade there would delete the group's real repositories.
    const deps = createController(() => null, { workspaceLineage: memberLineage })

    const result = await deps.controller.deleteFolderWorkspace('ws-1')

    expect(deps.removeMemberWorktree).not.toHaveBeenCalled()
    expect(result.memberTeardown).toBeUndefined()
    expect(deps.removeFolderWorkspace).toHaveBeenCalledWith('ws-1')
  })
})
