import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

export type WorkspaceOpenInTarget = {
  /** Stable key for the menu row. */
  id: string
  label: string
  path: string
  isRoot: boolean
}

/**
 * What an external app can be pointed at for the active workspace.
 *
 * A plain worktree offers only itself. A group workspace offers its container plus one entry per
 * member checkout, because an IDE opened on the container indexes every repo at once while most
 * work is scoped to one of them.
 */
export function buildWorkspaceOpenInTargets(args: {
  worktreePath: string
  rootLabel: string
  memberWorktrees: readonly Worktree[]
  repos: readonly Pick<Repo, 'id' | 'displayName'>[]
}): WorkspaceOpenInTarget[] {
  const root: WorkspaceOpenInTarget = {
    id: 'workspace-root',
    label: args.rootLabel,
    path: args.worktreePath,
    isRoot: true
  }
  if (args.memberWorktrees.length === 0) {
    return [root]
  }
  const repoNameById = new Map(args.repos.map((repo) => [repo.id, repo.displayName]))
  return [
    root,
    ...args.memberWorktrees.map((worktree) => ({
      id: worktree.id,
      // Why the repo name wins: the member's own display name is the workspace name, which is
      // identical across every member and would render the list as N copies of one label.
      label: repoNameById.get(worktree.repoId) ?? worktree.displayName,
      path: worktree.path,
      isRoot: false
    }))
  ]
}
