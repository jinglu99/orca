import {
  isRuntimePathAbsolute,
  isWindowsAbsolutePathLike,
  normalizeRuntimePathSeparators,
  resolveRuntimePath
} from '../../shared/cross-platform-path'
import type { ProjectGroup } from '../../shared/project-group-types'
import { sanitizeWorktreeName } from '../ipc/worktree-logic'

type ContainerGroup = Pick<ProjectGroup, 'name' | 'parentPath'>

/**
 * The directory an isolated group workspace owns, laid out workspace-major:
 * `<workspace root>/<group>/<workspace>`, with one member repo's worktree per subdirectory.
 *
 * Why the inverse of the per-repo layout (`<root>/<repo>/<workspace>`): a group workspace's
 * point is that one feature's checkouts sit together, so the workspace has to be the directory
 * the repos hang off, not the leaf.
 */
export function computeGroupWorkspaceContainerPath(args: {
  group: ContainerGroup
  workspaceName: string
  workspaceDir: string
  connectionId?: string | null
}): string {
  const root = resolveGroupWorkspaceRoot(args.group, args.workspaceDir, args.connectionId)
  const groupSegment = sanitizeWorktreeName(args.group.name)
  const workspaceSegment = sanitizeWorktreeName(args.workspaceName)
  return resolveRuntimePath(root, `${groupSegment}/${workspaceSegment}`)
}

/**
 * Why a group needs its own root resolution rather than a repo's: `workspaceDir` may be
 * repo-relative, and a group has no single repo to anchor it. The group's parent folder is the
 * only anchor every folder-backed group has, so a relative root without one is refused instead of
 * silently resolving against the app's cwd.
 */
export function resolveGroupWorkspaceRoot(
  group: ContainerGroup,
  workspaceDir: string,
  connectionId?: string | null
): string {
  const configured = workspaceDir.trim()
  if (!configured) {
    throw new Error('group_workspace_root_unset')
  }
  const pathFlavor =
    isWindowsAbsolutePathLike(configured) || isWindowsAbsolutePathLike(group.parentPath ?? '')
      ? 'windows'
      : 'posix'
  if (isRuntimePathAbsolute(configured, pathFlavor)) {
    // Why refused rather than used: an absolute workspace root is a path on the desktop machine,
    // and creating it on the execution host would scatter directories that mirror the operator's
    // own filesystem. A repo-relative root resolves against the group's remote parent and is fine.
    if (connectionId) {
      throw new Error('group_workspace_root_not_on_execution_host')
    }
    return normalizeRuntimePathSeparators(configured)
  }
  if (!group.parentPath) {
    throw new Error('group_workspace_root_unanchored')
  }
  return resolveRuntimePath(group.parentPath, configured)
}
