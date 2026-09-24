import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import type { Repo } from '../../../shared/repo-types'
import type { WorkspaceSource as WorkspaceCreateTelemetrySource } from '../../../shared/workspace-source'
import { planGroupWorkspaceMemberPaths } from '../../../shared/group-workspace-member-path'
import type { WorktreeSlice } from '@/store/slices/worktree-helpers'

export type GroupWorkspaceMemberOutcome =
  | {
      repoId: string
      repoName: string
      status: 'created'
      worktreeId: string
      path: string
      /** Carried back so the caller can report all of them in one notice instead of N sticky ones. */
      staleLocalBaseBranch?: string
    }
  | { repoId: string; repoName: string; status: 'failed'; error: string }

type CreateGroupWorkspaceMembersArgs = {
  workspace: FolderWorkspace
  repos: readonly Repo[]
  telemetrySource?: WorkspaceCreateTelemetrySource
  /** True to branch from the base ref already on disk instead of fetching each repo first. */
  skipBaseFetch?: boolean
  createWorktree: WorktreeSlice['createWorktree']
}

/**
 * Creates one git worktree per member repo inside a group workspace's container directory.
 *
 * Why every member is settled rather than the batch aborted on the first failure: a repo can fail
 * for reasons that have nothing to do with the others — a missing base ref, a branch already
 * checked out elsewhere — and an agent can still do useful work in the repos that did land. The
 * caller reports the failures and offers a retry instead of unwinding checkouts that are fine.
 *
 * Why no `branchNameOverride`: every member derives its branch from the same workspace name, so
 * they agree by construction, and a repo that hits a branch collision is free to suffix only its
 * own rather than failing the whole group.
 */
export async function createGroupWorkspaceMembers({
  workspace,
  repos,
  telemetrySource,
  skipBaseFetch = false,
  createWorktree
}: CreateGroupWorkspaceMembersArgs): Promise<GroupWorkspaceMemberOutcome[]> {
  const placements = planGroupWorkspaceMemberPaths(workspace.folderPath, repos)
  const settled = await Promise.allSettled(
    placements.map((placement, index) =>
      createWorktree(
        placement.repoId,
        workspace.name,
        undefined,
        'inherit',
        undefined,
        telemetrySource,
        undefined,
        undefined,
        undefined,
        undefined,
        // Why no agent here: the agent launches once at the container, not once per checkout.
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          parentFolderWorkspaceId: workspace.id,
          worktreePathOverride: placement.path,
          // Why opt-in rather than always: a blocking fetch per repo through the host's 3-wide
          // network budget is what makes a large group take minutes, but skipping it means
          // branching from whatever the last fetch left on disk. The caller decides.
          ...(skipBaseFetch ? { baseRefRefresh: 'background' as const } : {}),
          suppressCreateNotices: true
        }
      ).then((result) => ({ index, result }))
    )
  )
  return settled.map((entry, index) => {
    const repo = repos[index]
    const repoName = repo.displayName || placements[index].segment
    if (entry.status === 'fulfilled') {
      const refresh = entry.value.result.localBaseRefRefresh
      return {
        repoId: repo.id,
        repoName,
        status: 'created',
        worktreeId: entry.value.result.worktree.id,
        path: entry.value.result.worktree.path,
        ...(refresh && refresh.status !== 'updated'
          ? { staleLocalBaseBranch: refresh.localBranch }
          : {})
      }
    }
    return {
      repoId: repo.id,
      repoName,
      status: 'failed',
      error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason)
    }
  })
}

export function summarizeGroupWorkspaceMemberFailures(
  outcomes: readonly GroupWorkspaceMemberOutcome[]
): {
  createdCount: number
  failed: GroupWorkspaceMemberOutcome[]
  staleBaseRepos: { repoName: string; localBranch: string }[]
} {
  const failed = outcomes.filter((outcome) => outcome.status === 'failed')
  const staleBaseRepos = outcomes.flatMap((outcome) =>
    outcome.status === 'created' && outcome.staleLocalBaseBranch
      ? [{ repoName: outcome.repoName, localBranch: outcome.staleLocalBaseBranch }]
      : []
  )
  return { createdCount: outcomes.length - failed.length, failed, staleBaseRepos }
}
