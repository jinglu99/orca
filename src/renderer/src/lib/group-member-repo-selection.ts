import type { Repo } from '../../../shared/repo-types'

/**
 * The repos a group create will actually give a worktree.
 *
 * Why `null` rather than a full set for "everything": a frozen snapshot silently stops covering
 * repos added to the group afterwards, so sticky-all stays a distinct state instead of a set that
 * happens to match today.
 */
export function resolveSelectedGroupMemberRepos(
  repos: readonly Repo[],
  selectedRepoIds: ReadonlySet<string> | null
): Repo[] {
  if (!selectedRepoIds) {
    return [...repos]
  }
  const selected = repos.filter((repo) => selectedRepoIds.has(repo.id))
  // Why fall back to everything: the picker never emits an empty selection, so an empty result
  // means the ids belong to a group the user has since switched away from. Creating a container
  // with no checkouts in it would be worse than covering the group.
  return selected.length > 0 ? selected : [...repos]
}

/** Whether the stored selection still describes the repos on offer. */
export function isStaleGroupMemberSelection(
  repos: readonly Repo[],
  selectedRepoIds: ReadonlySet<string> | null
): boolean {
  if (!selectedRepoIds) {
    return false
  }
  return !repos.some((repo) => selectedRepoIds.has(repo.id))
}
