import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Repo } from '../../../../shared/repo-types'
import type { WorkspaceSource as WorkspaceCreateTelemetrySource } from '../../../../shared/workspace-source'
import {
  createGroupWorkspaceMembers,
  summarizeGroupWorkspaceMemberFailures
} from '@/lib/group-workspace-members'
import { ownsFolderWorkspaceDirectory } from '../../../../shared/folder-workspace-layout'
import type { WorktreeSlice } from '@/store/slices/worktree-helpers'

/**
 * Fans a new group workspace out into one worktree per member repo, reporting the repos that
 * failed without unwinding the ones that succeeded.
 *
 * Returns once every member has settled, so the caller reveals a workspace whose checkouts are
 * already on disk rather than starting an agent in a directory of empty placeholders.
 */
export async function createGroupWorkspaceMemberWorktrees(args: {
  workspace: FolderWorkspace
  memberRepos: readonly Repo[]
  telemetrySource?: WorkspaceCreateTelemetrySource
  skipBaseFetch?: boolean
  createWorktree: WorktreeSlice['createWorktree']
}): Promise<void> {
  if (!ownsFolderWorkspaceDirectory(args.workspace) || args.memberRepos.length === 0) {
    return
  }
  const outcomes = await createGroupWorkspaceMembers({
    workspace: args.workspace,
    repos: args.memberRepos,
    ...(args.telemetrySource ? { telemetrySource: args.telemetrySource } : {}),
    ...(args.skipBaseFetch ? { skipBaseFetch: true } : {}),
    createWorktree: args.createWorktree
  })
  const { createdCount, failed, staleBaseRepos } = summarizeGroupWorkspaceMemberFailures(outcomes)
  if (staleBaseRepos.length > 0) {
    // Why one notice for the whole group: the per-create notice is sticky and keyed per worktree,
    // so a large group would bury the screen in identical warnings that all say the same thing —
    // the main checkout has uncommitted changes, so its local branch could not fast-forward.
    toast.warning(
      translate(
        'auto.components.sidebar.groupWorkspaceLocalBasesNotRefreshed',
        'Local base branch not refreshed in {{value0}} repositories',
        { value0: String(staleBaseRepos.length) }
      ),
      {
        description: translate(
          'auto.components.sidebar.groupWorkspaceLocalBasesNotRefreshedDetail',
          'Each checkout below has uncommitted changes, so Orca left its local branch alone. The new worktrees were still created from the remote branch.\n{{value0}}',
          {
            value0: staleBaseRepos
              .map((repo) => `${repo.repoName} (${repo.localBranch})`)
              .join(', ')
          }
        )
      }
    )
  }
  if (failed.length === 0) {
    return
  }
  toast.warning(
    translate(
      'auto.components.sidebar.groupWorkspaceMembersPartiallyCreated',
      'Created {{value0}} of {{value1}} repositories in "{{value2}}"',
      {
        value0: String(createdCount),
        value1: String(outcomes.length),
        value2: args.workspace.name
      }
    ),
    {
      description: failed
        .map((outcome) =>
          outcome.status === 'failed' ? `${outcome.repoName}: ${outcome.error}` : outcome.repoName
        )
        .join('\n')
    }
  )
}
