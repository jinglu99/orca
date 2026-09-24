import { readdir } from 'node:fs/promises'
import { planGroupWorkspaceLinkedPaths } from '../../shared/group-workspace-linked-paths'
import { getProjectGroupSubtreeIds } from '../../shared/project-groups'
import { isGitRepoKind } from '../../shared/repo-kind'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { Repo } from '../../shared/repo-types'
import { createWorktreeSharedPaths } from '../ipc/worktree-symlinks'

/**
 * Shares the group root's agent instructions and registered non-git projects into a new container.
 *
 * Why `createWorktreeSharedPaths` and not `createWorktreeLinkedPaths`: the link variant APFS
 * clone-copies when it can, which on macOS would hand every workspace a private snapshot of the
 * group's instructions. These are meant to stay one file — editing the group's AGENTS.md should
 * reach workspaces that already exist — so this uses the variant that always symlinks.
 *
 * Best effort by design: the container and its worktrees are the workspace, and a group root that
 * cannot be read should not fail a create that otherwise succeeded.
 */
export async function shareGroupWorkspaceContextPaths(args: {
  group: ProjectGroup
  projectGroups: readonly ProjectGroup[]
  repos: readonly Repo[]
  containerPath: string
  connectionId: string | null
}): Promise<void> {
  // Why local only: the symlink helpers run against the desktop filesystem, and an SSH group's
  // root lives on the execution host. Sharing there needs a relay method that does not exist yet.
  if (args.connectionId || !args.group.parentPath) {
    return
  }
  const groupParentPath = args.group.parentPath
  const groupIds = getProjectGroupSubtreeIds(args.projectGroups, args.group.id)
  const groupRepos = args.repos.filter(
    (repo) => typeof repo.projectGroupId === 'string' && groupIds.has(repo.projectGroupId)
  )
  try {
    const entries = await readdir(groupParentPath)
    const planned = planGroupWorkspaceLinkedPaths({
      groupParentPath,
      groupRootEntries: entries,
      memberRepoPaths: groupRepos.filter(isGitRepoKind).map((repo) => repo.path),
      folderProjectPaths: groupRepos.filter((repo) => !isGitRepoKind(repo)).map((repo) => repo.path)
    })
    if (planned.length === 0) {
      return
    }
    await createWorktreeSharedPaths(groupParentPath, args.containerPath, planned)
  } catch (error) {
    console.warn(`[group-workspace] failed to share context paths from ${groupParentPath}:`, error)
  }
}
