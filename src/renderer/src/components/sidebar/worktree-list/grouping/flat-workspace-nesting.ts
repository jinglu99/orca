import type {
  WorkspaceLineage,
  WorktreeLineage
} from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import { folderWorkspaceToWorktree } from '../../../../../../shared/folder-workspace-worktree'
import { parseWorkspaceKey } from '../../../../../../shared/workspace-scope'
import { getWorktreeVisitTimestamp } from '@/lib/worktree-visit-recency'
import { getWorkspaceLineageChild } from '../../folder-workspace-card-pr-display'
import { getProjectedWorktreeLineageChildrenByParentId } from '../../worktree-lineage-projection'
import { effectiveRecentActivity, type SortBy } from '../../smart-sort'
import {
  compareFolderWorkspacesForDisplay,
  type RenderableFolderWorkspace
} from './folder-workspace-lanes'
import { buildFolderWorkspaceRow } from './row-builders'
import type { Row, WorktreeGroupBy } from './row-types'

export type FlatWorkspaceNesting = {
  /** Member worktree host identity → the folder workspace it was created for. */
  folderIdByMemberIdentity: ReadonlyMap<string, string>
  /** Set only under Recently used, where folder rows interleave with worktrees by recency. */
  lastVisitedAtByWorktreeId?: Readonly<Record<string, number>>
}

/**
 * Which worktrees fold under a folder workspace in the flat list: a group workspace's per-repo
 * members (recorded as workspace lineage children) plus their own lineage descendants.
 */
export function buildFlatWorkspaceNesting(args: {
  groupBy: WorktreeGroupBy
  sortBy: SortBy
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>> | null | undefined
  worktreeLineageById: Readonly<Record<string, WorktreeLineage>>
  worktreeMap: ReadonlyMap<string, Worktree>
  lastVisitedAtByWorktreeId: Readonly<Record<string, number>>
}): FlatWorkspaceNesting | undefined {
  if (args.groupBy !== 'none') {
    return undefined
  }
  const folderIdByMemberIdentity = new Map<string, string>()
  let childrenByParentId: Map<string, Worktree[]> | null = null
  for (const lineage of Object.values(args.workspaceLineageByChildKey ?? {})) {
    const parent = parseWorkspaceKey(lineage.parentWorkspaceKey)
    if (parent?.type !== 'folder') {
      continue
    }
    const member = getWorkspaceLineageChild(lineage, args.worktreeMap)
    if (!member) {
      continue
    }
    childrenByParentId ??= getProjectedWorktreeLineageChildrenByParentId(
      args.worktreeLineageById,
      args.worktreeMap
    )
    const queue = [member]
    for (let index = 0; index < queue.length; index += 1) {
      const identity = getWorktreeHostIdentity(queue[index])
      if (folderIdByMemberIdentity.has(identity)) {
        continue
      }
      folderIdByMemberIdentity.set(identity, parent.folderWorkspaceId)
      queue.push(...(childrenByParentId.get(queue[index].id) ?? []))
    }
  }
  return {
    folderIdByMemberIdentity,
    ...(args.sortBy === 'visited'
      ? { lastVisitedAtByWorktreeId: args.lastVisitedAtByWorktreeId }
      : {})
  }
}

/**
 * Toggle key for the members nested under a folder workspace row.
 *
 * Why inverted (present = expanded): members start folded, so collapsedGroups records the
 * folders the user opened rather than the ones they closed.
 */
export function getFolderMembersExpandedKey(folderWorkspaceId: string): string {
  return `folder-members-expanded:${folderWorkspaceId}`
}

/** Expanded keys of every folder workspace that has members, for the header's expand/collapse-all sweep. */
export function getFolderMembersExpandedKeys(
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>> | null | undefined,
  folderWorkspaces: readonly { id: string }[]
): string[] {
  const folderIds = new Set(folderWorkspaces.map((workspace) => workspace.id))
  const keys = new Set<string>()
  for (const lineage of Object.values(workspaceLineageByChildKey ?? {})) {
    const parent = parseWorkspaceKey(lineage.parentWorkspaceKey)
    if (
      parent?.type === 'folder' &&
      folderIds.has(parent.folderWorkspaceId) &&
      parseWorkspaceKey(lineage.childWorkspaceKey)?.type === 'worktree'
    ) {
      keys.add(getFolderMembersExpandedKey(parent.folderWorkspaceId))
    }
  }
  return [...keys]
}

type Recency = readonly [visitedAt: number, activityAt: number]

function compareRecency(a: Recency, b: Recency): number {
  return b[0] - a[0] || b[1] - a[1]
}

/**
 * Emits the flat (Group by: none) list: worktrees, then folder workspaces with their members
 * nested beneath them — or, under Recently used, folder rows placed by their latest use.
 */
export function appendFlatWorkspaceRows(args: {
  result: Row[]
  worktrees: readonly Worktree[]
  folderPairs: readonly RenderableFolderWorkspace[]
  nesting: FlatWorkspaceNesting | undefined
  collapsedGroups: ReadonlySet<string>
  appendWorktrees: (target: Row[], worktrees: Worktree[], rootDepth: number) => void
}): void {
  const { result, nesting, collapsedGroups, appendWorktrees } = args
  const renderedFolderIds = new Set(args.folderPairs.map((pair) => pair.folderWorkspace.id))
  const membersByFolderId = new Map<string, Worktree[]>()
  const topLevel: Worktree[] = []
  for (const worktree of args.worktrees) {
    const folderId = nesting?.folderIdByMemberIdentity.get(getWorktreeHostIdentity(worktree))
    // Why only rendered folders: a member whose folder is filtered out must stay visible.
    if (folderId && renderedFolderIds.has(folderId)) {
      const members = membersByFolderId.get(folderId) ?? []
      members.push(worktree)
      membersByFolderId.set(folderId, members)
    } else {
      topLevel.push(worktree)
    }
  }

  const emitFolder = (pair: RenderableFolderWorkspace): void => {
    const members = membersByFolderId.get(pair.folderWorkspace.id) ?? []
    if (members.length === 0) {
      result.push(buildFolderWorkspaceRow(pair, 0))
      return
    }
    const lineageGroupKey = getFolderMembersExpandedKey(pair.folderWorkspace.id)
    const lineageCollapsed = !collapsedGroups.has(lineageGroupKey)
    result.push(
      buildFolderWorkspaceRow(pair, 0, {
        lineageChildCount: members.length,
        lineageGroupKey,
        lineageCollapsed
      })
    )
    if (!lineageCollapsed) {
      appendWorktrees(result, members, 1)
    }
  }

  const visits = nesting?.lastVisitedAtByWorktreeId
  if (!visits) {
    appendWorktrees(result, topLevel, 0)
    for (const pair of [...args.folderPairs].sort((left, right) =>
      compareFolderWorkspacesForDisplay(left.folderWorkspace, right.folderWorkspace)
    )) {
      emitFolder(pair)
    }
    return
  }

  const now = Date.now()
  const recencyOf = (worktree: Worktree): Recency => [
    getWorktreeVisitTimestamp(visits, worktree) ?? 0,
    effectiveRecentActivity(worktree, now)
  ]
  const folders = args.folderPairs
    .map((pair) => {
      // Why include members: working inside a member checkout is using the group workspace.
      let recency = recencyOf(folderWorkspaceToWorktree(pair.folderWorkspace))
      for (const member of membersByFolderId.get(pair.folderWorkspace.id) ?? []) {
        const memberRecency = recencyOf(member)
        recency = [Math.max(recency[0], memberRecency[0]), Math.max(recency[1], memberRecency[1])]
      }
      return { pair, recency }
    })
    .sort(
      (left, right) =>
        compareRecency(left.recency, right.recency) ||
        compareFolderWorkspacesForDisplay(left.pair.folderWorkspace, right.pair.folderWorkspace)
    )

  // Why split rendered rows at each root: a lineage subtree must stay together, and roots
  // already arrive in Recently used order, so folders merge in between subtrees.
  const worktreeRows: Row[] = []
  appendWorktrees(worktreeRows, topLevel, 0)
  let folderIndex = 0
  for (const row of worktreeRows) {
    if (row.type === 'item' && row.depth === 0) {
      const recency = recencyOf(row.worktree)
      while (
        folderIndex < folders.length &&
        compareRecency(folders[folderIndex].recency, recency) < 0
      ) {
        emitFolder(folders[folderIndex].pair)
        folderIndex += 1
      }
    }
    result.push(row)
  }
  for (; folderIndex < folders.length; folderIndex += 1) {
    emitFolder(folders[folderIndex].pair)
  }
}
