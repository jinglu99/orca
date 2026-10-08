// Split out of protocol-version.ts, which spreads the list below into RUNTIME_CAPABILITIES.
export const FOLDER_WORKSPACE_PATH_STATUS_RUNTIME_CAPABILITY =
  'folder-workspace.path-status.v1' as const
/** The host understands `layout: 'isolated-container'` on folderWorkspace.create and
 *  `worktreePathOverride` on worktree.create. Negotiated rather than sent optimistically: an older
 *  host drops both silently, which would scatter a group workspace's members across per-repo
 *  directories instead of co-locating them, with no error to show the user. */
export const GROUP_WORKSPACE_LAYOUT_RUNTIME_CAPABILITY = 'group-workspace.layout.v1' as const
export const GROUP_WORKSPACE_LAYOUT_UPDATE_REQUIRED_MESSAGE =
  'Update the remote runtime to create grouped workspaces'

export const FOLDER_WORKSPACE_RUNTIME_CAPABILITIES = [
  FOLDER_WORKSPACE_PATH_STATUS_RUNTIME_CAPABILITY,
  GROUP_WORKSPACE_LAYOUT_RUNTIME_CAPABILITY
] as const
