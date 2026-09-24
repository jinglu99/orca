import type {
  PreservedWorktreeBranch,
  RemoveWorktreeResult
} from '../../shared/worktree/create-types'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../shared/workspace-scope'

export type GroupWorkspaceMemberRemoval = {
  worktreeId: string
  status: 'removed' | 'failed'
  error?: string
  preservedBranch?: PreservedWorktreeBranch
}

export type GroupWorkspaceMemberTeardown = {
  removals: GroupWorkspaceMemberRemoval[]
  /** Branches git refused to drop, gathered across every member repo. */
  preservedBranches: { worktreeId: string; branch: PreservedWorktreeBranch }[]
  allRemoved: boolean
}

/** The worktrees attached to this folder workspace, which for a container layout are its members. */
export function listGroupWorkspaceMemberWorktreeIds(
  workspaceLineageByChildKey: Record<string, WorkspaceLineage>,
  folderWorkspaceId: string
): string[] {
  const parentKey = folderWorkspaceKey(folderWorkspaceId)
  const worktreeIds: string[] = []
  for (const lineage of Object.values(workspaceLineageByChildKey)) {
    if (lineage.parentWorkspaceKey !== parentKey) {
      continue
    }
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    if (child?.type === 'worktree') {
      worktreeIds.push(child.worktreeId)
    }
  }
  return worktreeIds
}

/**
 * Removes a group workspace's member worktrees, one repo at a time.
 *
 * Why sequential: each removal runs git in its own repo but shares the preserved-branch bookkeeping
 * and the PTY sweep, and a group is a handful of repos — ordering them keeps a failure attributable
 * to one repo instead of interleaved across several.
 *
 * Why failures are collected rather than thrown: the caller needs to know that some checkouts are
 * still on disk so it can leave the container in place instead of orphaning them.
 */
export async function removeGroupWorkspaceMembers(args: {
  worktreeIds: readonly string[]
  removeWorktree: (worktreeId: string) => Promise<RemoveWorktreeResult>
}): Promise<GroupWorkspaceMemberTeardown> {
  const removals: GroupWorkspaceMemberRemoval[] = []
  const preservedBranches: { worktreeId: string; branch: PreservedWorktreeBranch }[] = []
  for (const worktreeId of args.worktreeIds) {
    try {
      const result = await args.removeWorktree(worktreeId)
      removals.push({
        worktreeId,
        status: 'removed',
        ...(result.preservedBranch ? { preservedBranch: result.preservedBranch } : {})
      })
      if (result.preservedBranch) {
        preservedBranches.push({ worktreeId, branch: result.preservedBranch })
      }
    } catch (error) {
      removals.push({
        worktreeId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return {
    removals,
    preservedBranches,
    allRemoved: removals.every((removal) => removal.status === 'removed')
  }
}
