import type { FolderWorkspaceLayout } from '../../shared/folder-workspace-layout'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { Repo } from '../../shared/repo-types'
import type { IFilesystemProvider } from '../providers/types'
import {
  assertFolderWorkspacePathUsable,
  getFolderWorkspacePathStatusForPath
} from './folder-workspace-path-status'
import { claimGroupWorkspaceContainerDirectory } from './group-workspace-container-directory'
import { computeGroupWorkspaceContainerPath } from './group-workspace-container-path'
import { shareGroupWorkspaceContextPaths } from './group-workspace-context-links'

type FolderWorkspaceCreateLocationDeps = {
  getSshFilesystemProvider: (connectionId: string) => IFilesystemProvider | undefined
}

/**
 * Settles where a new folder workspace lives and makes that location usable.
 *
 * Shared by the IPC handler and the runtime RPC controller so the two entry points cannot drift
 * on which layout creates a directory and which one demands an existing directory.
 */
export async function resolveFolderWorkspaceCreateLocation(
  args: {
    group: ProjectGroup
    projectGroups: readonly ProjectGroup[]
    repos: readonly Repo[]
    layout?: FolderWorkspaceLayout
    workspaceName: string
    explicitFolderPath?: string | null
    connectionId: string | null
    workspaceDir: string
  },
  deps: FolderWorkspaceCreateLocationDeps
): Promise<string> {
  const explicitFolderPath =
    typeof args.explicitFolderPath === 'string' && args.explicitFolderPath.trim().length > 0
      ? args.explicitFolderPath
      : undefined

  if (args.layout === 'isolated-container') {
    const containerPath =
      explicitFolderPath ??
      computeGroupWorkspaceContainerPath({
        group: args.group,
        workspaceName: args.workspaceName,
        workspaceDir: args.workspaceDir,
        connectionId: args.connectionId
      })
    // Why created rather than validated: this directory is the workspace's own, and nothing else
    // may already hold it.
    await claimGroupWorkspaceContainerDirectory(
      { containerPath, connectionId: args.connectionId },
      deps
    )
    // Why here rather than after the members land: an agent can be launched at the container the
    // moment the record exists, and starting it without the group's instructions is the failure
    // this whole step exists to avoid.
    await shareGroupWorkspaceContextPaths({
      group: args.group,
      projectGroups: args.projectGroups,
      repos: args.repos,
      containerPath,
      connectionId: args.connectionId
    })
    return containerPath
  }

  const folderPath = explicitFolderPath ?? args.group.parentPath
  if (!folderPath) {
    throw new Error('folder_workspace_project_group_not_found')
  }
  // Why validated rather than created: a shared-parent workspace adopts a directory the user
  // already has, so a missing one is a stale registration, not something to materialize.
  const status = await getFolderWorkspacePathStatusForPath(
    {
      folderPath,
      projectGroupId: args.group.id,
      connectionId: args.connectionId,
      projectGroups: args.projectGroups,
      repos: args.repos
    },
    deps
  )
  assertFolderWorkspacePathUsable(status)
  return folderPath
}
