import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { Repo } from '../../shared/repo-types'
import type {
  FolderWorkspacePathStatus,
  FolderWorkspacePathStatusRequest
} from '../../shared/folder-workspace-path-status'
import {
  assertFolderWorkspacePathUsable,
  getFolderWorkspacePathStatus,
  getFolderWorkspacePathStatusForPath
} from '../project-groups/folder-workspace-path-status'
import { getSshFilesystemProvider } from '../providers/ssh-filesystem-dispatch'
import { normalizeFolderWorkspaceName } from '../../shared/folder-workspaces'
import { resolveFolderWorkspaceCreateLocation } from '../project-groups/folder-workspace-create-location'
import type { RuntimeStore } from './runtime-store-contract'
import { folderWorkspaceKey } from '../../shared/workspace-scope'
import type { RemoveWorktreeResult } from '../../shared/worktree/create-types'
import { ownsFolderWorkspaceDirectory } from '../../shared/folder-workspace-layout'
import { removeGroupWorkspaceContainerDirectory } from '../project-groups/group-workspace-container-directory'
import {
  listGroupWorkspaceMemberWorktreeIds,
  removeGroupWorkspaceMembers,
  type GroupWorkspaceMemberTeardown
} from './group-workspace-member-teardown'

type RuntimeProjectGroupDependencies = {
  getStore: () => RuntimeStore | null
  resolveRepo: (selector: string) => Promise<Repo>
  notifyReposChanged: () => void
  resolveFolderConnectionId: (workspace: FolderWorkspace) => string | null
  teardownFolderWorkspacePtys: (worktreeId: string, connectionId: string | null) => Promise<void>
  cleanupRemovedFolderWorkspaceState: (worktreeId: string) => void
  /** Removes one member checkout, reusing the ordinary worktree removal path. */
  removeMemberWorktree: (worktreeId: string) => Promise<RemoveWorktreeResult>
}

type FolderWorkspaceUpdates = Partial<
  Pick<
    FolderWorkspace,
    | 'name'
    | 'folderPath'
    | 'linkedTask'
    | 'linkedTaskSourceContext'
    | 'comment'
    | 'isArchived'
    | 'isUnread'
    | 'isPinned'
    | 'sortOrder'
    | 'manualOrder'
    | 'workspaceStatus'
    | 'createdWithAgent'
    | 'pendingFirstAgentMessageRename'
    | 'firstAgentMessageRenameError'
    | 'lastActivityAt'
    | 'diffComments'
  >
>

export class RuntimeProjectGroupController {
  constructor(private readonly deps: RuntimeProjectGroupDependencies) {}

  listGroups(): ProjectGroup[] {
    return this.deps.getStore()?.getProjectGroups?.() ?? []
  }

  listFolderWorkspaces(): FolderWorkspace[] {
    return this.deps.getStore()?.getFolderWorkspaces?.() ?? []
  }

  async createGroup(input: {
    name: string
    parentPath?: string | null
    connectionId?: string | null
    parentGroupId?: string | null
    createdFrom?: ProjectGroup['createdFrom']
  }): Promise<ProjectGroup> {
    const store = this.deps.getStore()
    if (!store?.createProjectGroup) {
      throw new Error('runtime_unavailable')
    }
    const group = store.createProjectGroup({
      name: input.name,
      parentPath: input.parentPath ?? null,
      connectionId: input.connectionId ?? null,
      parentGroupId: input.parentGroupId ?? null,
      createdFrom: input.createdFrom ?? 'manual'
    })
    this.deps.notifyReposChanged()
    return group
  }

  async updateGroup(
    groupId: string,
    updates: Partial<Pick<ProjectGroup, 'name' | 'isCollapsed' | 'tabOrder' | 'color'>>
  ): Promise<ProjectGroup | null> {
    const store = this.deps.getStore()
    if (!store?.updateProjectGroup) {
      throw new Error('runtime_unavailable')
    }
    const updated = store.updateProjectGroup(groupId, updates)
    if (updated) {
      this.deps.notifyReposChanged()
    }
    return updated
  }

  async deleteGroup(groupId: string): Promise<{ deleted: boolean }> {
    const store = this.deps.getStore()
    if (!store?.deleteProjectGroup) {
      throw new Error('runtime_unavailable')
    }
    const deleted = store.deleteProjectGroup(groupId)
    if (deleted) {
      this.deps.notifyReposChanged()
    }
    return { deleted }
  }

  async moveProject(repoSelector: string, groupId: string | null, order?: number): Promise<Repo> {
    const store = this.deps.getStore()
    if (!store?.moveProjectToGroup) {
      throw new Error('runtime_unavailable')
    }
    const repo = await this.deps.resolveRepo(repoSelector)
    const moved = store.moveProjectToGroup(repo.id, groupId, order)
    if (!moved) {
      throw new Error('repo_not_found')
    }
    this.deps.notifyReposChanged()
    return moved
  }

  async createFolderWorkspace(input: {
    projectGroupId: string
    name?: string
    folderPath?: string | null
    layout?: FolderWorkspace['layout']
    connectionId?: string | null
    creatorProvenance?: FolderWorkspace['creatorProvenance']
    linkedTask?: FolderWorkspace['linkedTask']
    linkedTaskSourceContext?: FolderWorkspace['linkedTaskSourceContext']
    createdWithAgent?: FolderWorkspace['createdWithAgent']
    pendingFirstAgentMessageRename?: boolean
  }): Promise<FolderWorkspace> {
    const store = this.deps.getStore()
    if (!store?.createFolderWorkspace) {
      throw new Error('runtime_unavailable')
    }
    const projectGroups = store.getProjectGroups?.() ?? []
    const group = projectGroups.find((entry) => entry.id === input.projectGroupId)
    if (!group) {
      throw new Error('folder_workspace_project_group_not_found')
    }
    const connectionId = input.connectionId ?? group.connectionId ?? null
    const workspaceName = normalizeFolderWorkspaceName(input.name, `${group.name} workspace`)
    const folderPath = await resolveFolderWorkspaceCreateLocation(
      {
        group,
        projectGroups,
        repos: store.getRepos(),
        layout: input.layout,
        workspaceName,
        explicitFolderPath: input.folderPath,
        connectionId,
        workspaceDir: store.getSettings().workspaceDir
      },
      { getSshFilesystemProvider }
    )
    const workspace = store.createFolderWorkspace({
      ...input,
      name: workspaceName,
      folderPath,
      creatorProvenance: input.creatorProvenance ?? { kind: 'host' }
    })
    this.deps.notifyReposChanged()
    return workspace
  }

  async getFolderPathStatus(
    request: FolderWorkspacePathStatusRequest
  ): Promise<FolderWorkspacePathStatus> {
    const store = this.deps.getStore()
    if (!store) {
      throw new Error('runtime_unavailable')
    }
    return getFolderWorkspacePathStatus(store, request, { getSshFilesystemProvider })
  }

  async updateFolderWorkspace(
    folderWorkspaceId: string,
    updates: FolderWorkspaceUpdates
  ): Promise<FolderWorkspace | null> {
    const store = this.deps.getStore()
    if (!store?.updateFolderWorkspace) {
      throw new Error('runtime_unavailable')
    }
    if (typeof updates.folderPath === 'string' && updates.folderPath.trim().length > 0) {
      const workspace = store
        .getFolderWorkspaces?.()
        .find((entry) => entry.id === folderWorkspaceId)
      if (!workspace) {
        return null
      }
      const projectGroups = store.getProjectGroups?.() ?? []
      const status = await getFolderWorkspacePathStatusForPath(
        {
          folderPath: updates.folderPath,
          projectGroupId: workspace.projectGroupId,
          connectionId:
            workspace.connectionId ??
            projectGroups.find((entry) => entry.id === workspace.projectGroupId)?.connectionId ??
            null,
          projectGroups,
          repos: store.getRepos()
        },
        { getSshFilesystemProvider }
      )
      assertFolderWorkspacePathUsable(status)
    }
    const updated = store.updateFolderWorkspace(folderWorkspaceId, updates)
    if (updated) {
      this.deps.notifyReposChanged()
    }
    return updated
  }

  async deleteFolderWorkspace(
    folderWorkspaceId: string
  ): Promise<{ deleted: boolean; memberTeardown?: GroupWorkspaceMemberTeardown }> {
    const store = this.deps.getStore()
    if (!store?.removeFolderWorkspace) {
      throw new Error('runtime_unavailable')
    }
    const workspace = store.getFolderWorkspaces?.().find((entry) => entry.id === folderWorkspaceId)
    let memberTeardown: GroupWorkspaceMemberTeardown | undefined
    if (workspace && ownsFolderWorkspaceDirectory(workspace)) {
      memberTeardown = await this.tearDownGroupWorkspaceMembers(store, workspace)
    }
    if (workspace) {
      const worktreeId = folderWorkspaceKey(folderWorkspaceId)
      // Why: a mixed-host group has no single PTY target; forgetting the
      // workspace must still succeed, so skip the sweep instead of failing.
      let connectionId: string | null | undefined
      try {
        connectionId = this.deps.resolveFolderConnectionId(workspace)
      } catch (error) {
        console.warn(`[folder-workspace] skipping PTY teardown for ${worktreeId}:`, error)
      }
      if (connectionId !== undefined) {
        await this.deps.teardownFolderWorkspacePtys(worktreeId, connectionId)
      }
      this.deps.cleanupRemovedFolderWorkspaceState(worktreeId)
    }
    const deleted = store.removeFolderWorkspace(folderWorkspaceId)
    if (deleted) {
      this.deps.notifyReposChanged()
    }
    return { deleted, ...(memberTeardown ? { memberTeardown } : {}) }
  }

  /**
   * Removes an isolated container's member checkouts and then the container itself.
   *
   * Why the directory is only removed once every member is gone: a member that refused to remove
   * still has a checkout inside, and deleting the container around it would orphan git's worktree
   * registration and take uncommitted work with it. A `shared-parent` workspace never reaches here
   * — that folderPath is the user's own source folder.
   */
  private async tearDownGroupWorkspaceMembers(
    store: RuntimeStore,
    workspace: FolderWorkspace
  ): Promise<GroupWorkspaceMemberTeardown> {
    const teardown = await removeGroupWorkspaceMembers({
      worktreeIds: listGroupWorkspaceMemberWorktreeIds(
        store.getAllWorkspaceLineage?.() ?? {},
        workspace.id
      ),
      removeWorktree: (worktreeId) => this.deps.removeMemberWorktree(worktreeId)
    })
    if (!teardown.allRemoved) {
      return teardown
    }
    try {
      await removeGroupWorkspaceContainerDirectory(
        {
          containerPath: workspace.folderPath,
          connectionId: this.deps.resolveFolderConnectionId(workspace)
        },
        { getSshFilesystemProvider }
      )
    } catch (error) {
      console.warn(`[folder-workspace] failed to remove container ${workspace.folderPath}:`, error)
    }
    return teardown
  }
}
