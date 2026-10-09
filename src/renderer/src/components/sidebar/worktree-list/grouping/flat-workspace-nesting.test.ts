import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows'
import {
  buildFlatWorkspaceNesting,
  getFolderMembersExpandedKey,
  getFolderMembersExpandedKeys
} from './flat-workspace-nesting'
import type { Row, WorktreeGroupBy } from './row-types'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import type { SortBy } from '../../smart-sort'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { Repo } from '../../../../../../shared/repo-types'
import type { WorkspaceLineage } from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host'
import { folderWorkspaceKey } from '../../../../../../shared/workspace-scope'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'Multi-repo Group',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const FOLDER: FolderWorkspace = {
  id: 'fw-1',
  projectGroupId: GROUP.id,
  name: 'feature',
  folderPath: '/tmp/parent/workspaces/feature',
  layout: 'isolated-container',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 1,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1
}

const GROUPED_REPO: Repo = { ...repo, projectGroupId: GROUP.id }

function makeWorktree(id: string, overrides: Partial<Worktree> = {}): Worktree {
  return { ...worktree, id, path: `/tmp/${id}`, displayName: id, ...overrides }
}

function memberLineage(worktreeId: string, folderId = FOLDER.id): WorkspaceLineage {
  return {
    childWorkspaceKey: `worktree:${worktreeId}`,
    parentWorkspaceKey: folderWorkspaceKey(folderId),
    origin: 'manual',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt: 1
  }
}

const memberA = makeWorktree('member-a')
const memberB = makeWorktree('member-b')
const standalone = makeWorktree('standalone')
const LINEAGE = {
  'worktree:member-a': memberLineage('member-a'),
  'worktree:member-b': memberLineage('member-b')
}

const EXPANDED = new Set([getFolderMembersExpandedKey(FOLDER.id)])

function buildFlatRows(options: {
  worktrees: Worktree[]
  sortBy?: SortBy
  groupBy?: WorktreeGroupBy
  collapsedGroups?: Set<string>
  folderWorkspaces?: FolderWorkspace[]
  lastVisitedAtByWorktreeId?: Record<string, number>
}): Row[] {
  const worktreeMap = new Map(options.worktrees.map((entry) => [entry.id, entry]))
  const groupBy = options.groupBy ?? 'none'
  return buildRows(
    groupBy,
    options.worktrees,
    new Map([[GROUPED_REPO.id, GROUPED_REPO]]),
    null,
    options.collapsedGroups ?? EXPANDED,
    undefined,
    undefined,
    'manual',
    {},
    worktreeMap,
    true,
    undefined,
    [GROUP],
    new Set(),
    new Map(),
    new Map(),
    [],
    undefined,
    options.folderWorkspaces ?? [FOLDER],
    undefined,
    LOCAL_EXECUTION_HOST_ID,
    undefined,
    buildFlatWorkspaceNesting({
      groupBy,
      sortBy: options.sortBy ?? 'name',
      workspaceLineageByChildKey: LINEAGE,
      worktreeLineageById: {},
      worktreeMap,
      lastVisitedAtByWorktreeId: options.lastVisitedAtByWorktreeId ?? {}
    })
  )
}

function describeRows(rows: Row[]): string[] {
  return rows.flatMap((row) => {
    if (row.type === 'item') {
      return [`${'  '.repeat(row.depth)}${row.worktree.id}`]
    }
    if (row.type === 'folder-workspace') {
      return [`folder:${row.folderWorkspace.id}(${row.lineageChildCount ?? 0})`]
    }
    return []
  })
}

describe('flat list folds group workspace members under their folder row', () => {
  it('nests members once instead of listing them beside the folder row', () => {
    const rows = buildFlatRows({ worktrees: [memberA, standalone, memberB] })
    expect(describeRows(rows)).toEqual(['standalone', 'folder:fw-1(2)', '  member-a', '  member-b'])
  })

  it('folds members by default until the folder row is expanded', () => {
    const rows = buildFlatRows({
      worktrees: [memberA, standalone, memberB],
      collapsedGroups: new Set<string>()
    })
    expect(describeRows(rows)).toEqual(['standalone', 'folder:fw-1(2)'])
    const folderRow = rows.find((row) => row.type === 'folder-workspace')
    expect(folderRow?.type === 'folder-workspace' && folderRow.lineageCollapsed).toBe(true)
  })

  it('keeps members top-level when their folder workspace is not rendered', () => {
    const rows = buildFlatRows({ worktrees: [memberA, standalone], folderWorkspaces: [] })
    expect(describeRows(rows)).toEqual(['member-a', 'standalone'])
  })

  it('leaves project grouping untouched', () => {
    expect(
      buildFlatWorkspaceNesting({
        groupBy: 'repo',
        sortBy: 'visited',
        workspaceLineageByChildKey: LINEAGE,
        worktreeLineageById: {},
        worktreeMap: new Map(),
        lastVisitedAtByWorktreeId: {}
      })
    ).toBeUndefined()
  })
})

describe('Recently used places folder rows by their latest use', () => {
  it('ranks a group workspace by its most recently used member', () => {
    const rows = buildFlatRows({
      worktrees: [standalone, memberA, memberB],
      sortBy: 'visited',
      lastVisitedAtByWorktreeId: { standalone: 100, 'member-b': 200 }
    })
    expect(describeRows(rows)).toEqual(['folder:fw-1(2)', '  member-a', '  member-b', 'standalone'])
  })

  it('puts an older group workspace after more recent worktrees', () => {
    const rows = buildFlatRows({
      worktrees: [standalone, memberA, memberB],
      sortBy: 'visited',
      lastVisitedAtByWorktreeId: { standalone: 300, 'member-a': 200 }
    })
    expect(describeRows(rows)).toEqual(['standalone', 'folder:fw-1(2)', '  member-a', '  member-b'])
  })
})

describe('header expand/collapse-all sweep', () => {
  it('targets only folder workspaces that exist and have member worktrees', () => {
    const lineage = { ...LINEAGE, 'worktree:orphan': memberLineage('orphan', 'gone') }
    expect(getFolderMembersExpandedKeys(lineage, [FOLDER, { id: 'empty' }])).toEqual([
      getFolderMembersExpandedKey(FOLDER.id)
    ])
  })
})
