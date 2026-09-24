import { mkdir, rm } from 'node:fs/promises'
import { resolveRuntimePath } from '../../shared/cross-platform-path'
import type { IFilesystemProvider } from '../providers/types'

type GroupWorkspaceContainerDeps = {
  getSshFilesystemProvider: (connectionId: string) => IFilesystemProvider | undefined
}

/**
 * Creates the directory an isolated group workspace owns, refusing to adopt an existing one.
 *
 * Why no-clobber rather than stat-then-create: two creates racing on the same workspace name both
 * see the path free, and the loser would silently share the winner's container — the exact
 * collision this layout exists to prevent. The parent chain is created permissively because it is
 * shared by every workspace in the group.
 */
export async function claimGroupWorkspaceContainerDirectory(
  args: { containerPath: string; connectionId?: string | null },
  deps: GroupWorkspaceContainerDeps
): Promise<void> {
  const parentPath = resolveRuntimePath(args.containerPath, '..')
  if (args.connectionId) {
    const provider = deps.getSshFilesystemProvider(args.connectionId)
    if (!provider) {
      throw new Error(`folder_workspace_host_unavailable:${args.connectionId}`)
    }
    await provider.createDir(parentPath)
    await provider.createDirNoClobber(args.containerPath)
    return
  }
  await mkdir(parentPath, { recursive: true })
  try {
    await mkdir(args.containerPath)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error(`folder_workspace_container_exists:${args.containerPath}`)
    }
    throw error
  }
}

/**
 * Removes a group workspace's own container directory once its members are gone.
 *
 * Only ever called for the `isolated-container` layout: a `shared-parent` workspace points at the
 * user's real source folder, and deleting that would take the group's checkouts with it.
 */
export async function removeGroupWorkspaceContainerDirectory(
  args: { containerPath: string; connectionId?: string | null },
  deps: GroupWorkspaceContainerDeps
): Promise<void> {
  if (args.connectionId) {
    const provider = deps.getSshFilesystemProvider(args.connectionId)
    if (!provider) {
      throw new Error(`folder_workspace_host_unavailable:${args.connectionId}`)
    }
    await provider.deletePath(args.containerPath, true)
    return
  }
  await rm(args.containerPath, { recursive: true, force: true })
}
