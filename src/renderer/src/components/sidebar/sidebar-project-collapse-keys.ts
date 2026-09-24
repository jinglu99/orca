import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import { UNGROUPED_PROJECT_GROUP_KEY } from '../../../../shared/project-groups'
import { getProjectGroupHeaderKey } from './worktree-list/grouping/group-keys'
import {
  buildProjectGroupingIndex,
  getProjectGroupingForRepo,
  type ProjectGroupingModel
} from './worktree-list/grouping/project-grouping'

export type SidebarProjectCollapseInput = {
  repos: readonly Repo[]
  projectGroups: readonly ProjectGroup[]
  projectGrouping?: ProjectGroupingModel
}

/**
 * Every collapsible project and project-group header the sidebar shows while grouping by project.
 *
 * Why derived from the catalog rather than read off the rendered rows: the expand/collapse control
 * lives in the sidebar header, which never sees the list's rows, and publishing render output into
 * the store to reach it would put layout work on the store's hot path.
 *
 * Deliberately excludes Pinned, lineage and the PR/status lanes — those are not the project list,
 * and sweeping them would silently undo nesting the user set up inside a project.
 */
export function getSidebarProjectCollapseKeys(input: SidebarProjectCollapseInput): string[] {
  const repoMap = new Map(input.repos.map((repo) => [repo.id, repo]))
  const projectIndex = buildProjectGroupingIndex(input.projectGrouping)
  const groupsById = new Map(input.projectGroups.map((group) => [group.id, group]))
  const keys: string[] = []
  const seen = new Set<string>()
  const add = (key: string): void => {
    if (key && !seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }

  for (const repo of input.repos) {
    add(getProjectGroupingForRepo(repo.id, repoMap, projectIndex).key)
    let currentGroupId = repo.projectGroupId ?? null
    if (!currentGroupId) {
      add(UNGROUPED_PROJECT_GROUP_KEY)
      continue
    }
    // Why the ancestry walk and the visited guard: nested groups each render their own header, and
    // a corrupted parent link must not spin here.
    const visited = new Set<string>()
    while (currentGroupId && !visited.has(currentGroupId)) {
      visited.add(currentGroupId)
      add(getProjectGroupHeaderKey(currentGroupId))
      currentGroupId = groupsById.get(currentGroupId)?.parentGroupId ?? null
    }
  }
  return keys
}

/** Whether every project header is already collapsed, so the control offers "expand all" instead. */
export function areAllSidebarProjectsCollapsed(
  projectKeys: readonly string[],
  collapsedGroups: ReadonlySet<string>
): boolean {
  return projectKeys.length > 0 && projectKeys.every((key) => collapsedGroups.has(key))
}

/** The next collapsed set for the sweep, leaving non-project sections untouched. */
export function applySidebarProjectCollapse(
  projectKeys: readonly string[],
  collapsedGroups: ReadonlySet<string>,
  collapse: boolean
): string[] {
  const next = new Set(collapsedGroups)
  for (const key of projectKeys) {
    if (collapse) {
      next.add(key)
    } else {
      next.delete(key)
    }
  }
  return [...next]
}
