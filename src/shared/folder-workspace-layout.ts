/**
 * Where a project group's workspace keeps its files.
 *
 * - `shared-parent`: the workspace points at the group's own parent folder, so every workspace in
 *   the group shares one set of checkouts.
 * - `isolated-container`: the workspace owns a directory of its own, holding one git worktree per
 *   repo in the group.
 *
 * Absent means `shared-parent`, and it is never backfilled: a stored `folderPath` that equals the
 * group parent is indistinguishable from a container a user deliberately put there, so only the
 * creating code path may claim a layout.
 */
export type FolderWorkspaceLayout = 'shared-parent' | 'isolated-container'

export const DEFAULT_FOLDER_WORKSPACE_LAYOUT: FolderWorkspaceLayout = 'shared-parent'

export function isFolderWorkspaceLayout(value: unknown): value is FolderWorkspaceLayout {
  return value === 'shared-parent' || value === 'isolated-container'
}

export function getFolderWorkspaceLayout(workspace: {
  layout?: FolderWorkspaceLayout
}): FolderWorkspaceLayout {
  return isFolderWorkspaceLayout(workspace.layout)
    ? workspace.layout
    : DEFAULT_FOLDER_WORKSPACE_LAYOUT
}

/** Whether this workspace owns its directory, and therefore may create and delete it. */
export function ownsFolderWorkspaceDirectory(workspace: {
  layout?: FolderWorkspaceLayout
}): boolean {
  return getFolderWorkspaceLayout(workspace) === 'isolated-container'
}
