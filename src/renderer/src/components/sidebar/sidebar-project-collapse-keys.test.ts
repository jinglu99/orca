import { describe, expect, it } from 'vitest'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import { UNGROUPED_PROJECT_GROUP_KEY } from '../../../../shared/project-groups'
import {
  applySidebarProjectCollapse,
  areAllSidebarProjectsCollapsed,
  getSidebarProjectCollapseKeys
} from './sidebar-project-collapse-keys'

function repo(id: string, projectGroupId?: string): Repo {
  return {
    id,
    path: `/src/${id}`,
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    ...(projectGroupId ? { projectGroupId } : {})
  }
}

function group(id: string, parentGroupId: string | null = null): ProjectGroup {
  return {
    id,
    name: id,
    parentPath: `/src/${id}`,
    parentGroupId,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
}

describe('getSidebarProjectCollapseKeys', () => {
  it('covers each project row and its group header', () => {
    const keys = getSidebarProjectCollapseKeys({
      repos: [repo('api', 'platform'), repo('web', 'platform')],
      projectGroups: [group('platform')]
    })

    expect(keys).toContain('repo:api')
    expect(keys).toContain('repo:web')
    expect(keys).toContain('project-group:platform')
  })

  it('walks nested group ancestry so every rendered header is covered', () => {
    const keys = getSidebarProjectCollapseKeys({
      repos: [repo('api', 'backend')],
      projectGroups: [group('platform'), group('backend', 'platform')]
    })

    expect(keys).toContain('project-group:backend')
    expect(keys).toContain('project-group:platform')
  })

  it('covers the ungrouped section for repos with no group', () => {
    const keys = getSidebarProjectCollapseKeys({ repos: [repo('loose')], projectGroups: [] })

    expect(keys).toContain(UNGROUPED_PROJECT_GROUP_KEY)
  })

  it('emits each key once when several repos share a group', () => {
    const keys = getSidebarProjectCollapseKeys({
      repos: [repo('api', 'platform'), repo('web', 'platform')],
      projectGroups: [group('platform')]
    })

    expect(keys.filter((key) => key === 'project-group:platform')).toHaveLength(1)
  })

  it('survives a group whose parent link points at itself', () => {
    const selfParented = group('loop', 'loop')
    const keys = getSidebarProjectCollapseKeys({
      repos: [repo('api', 'loop')],
      projectGroups: [selfParented]
    })

    expect(keys).toContain('project-group:loop')
  })

  it('returns nothing when there are no projects', () => {
    expect(getSidebarProjectCollapseKeys({ repos: [], projectGroups: [] })).toEqual([])
  })
})

describe('areAllSidebarProjectsCollapsed', () => {
  it('is false while any project is still expanded', () => {
    expect(areAllSidebarProjectsCollapsed(['a', 'b'], new Set(['a']))).toBe(false)
  })

  it('is true once every project key is collapsed', () => {
    expect(areAllSidebarProjectsCollapsed(['a', 'b'], new Set(['a', 'b']))).toBe(true)
  })

  it('is false with no projects, so the control never offers an empty expand', () => {
    expect(areAllSidebarProjectsCollapsed([], new Set())).toBe(false)
  })
})

describe('applySidebarProjectCollapse', () => {
  it('collapses every project without touching other sections', () => {
    // Why this matters: Pinned and lineage groups live in the same set, and sweeping them would
    // undo nesting the user arranged inside a project.
    const next = applySidebarProjectCollapse(['a', 'b'], new Set(['pinned', 'lineage:x']), true)

    expect(new Set(next)).toEqual(new Set(['a', 'b', 'pinned', 'lineage:x']))
  })

  it('expands every project without touching other sections', () => {
    const next = applySidebarProjectCollapse(
      ['a', 'b'],
      new Set(['a', 'b', 'pinned', 'lineage:x']),
      false
    )

    expect(new Set(next)).toEqual(new Set(['pinned', 'lineage:x']))
  })
})
