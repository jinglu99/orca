import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import {
  isStaleGroupMemberSelection,
  resolveSelectedGroupMemberRepos
} from './group-member-repo-selection'

function repo(id: string): Repo {
  return { id, path: `/src/${id}`, displayName: id, badgeColor: '#000', addedAt: 0, kind: 'git' }
}

const repos = [repo('a'), repo('b'), repo('c')]

describe('resolveSelectedGroupMemberRepos', () => {
  it('covers every repo when the selection is sticky-all', () => {
    expect(resolveSelectedGroupMemberRepos(repos, null).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps sticky-all covering a repo added to the group later', () => {
    // Why this is the point of `null`: a frozen set captured before `d` joined would quietly
    // leave it out of every future workspace.
    const grown = [...repos, repo('d')]
    expect(resolveSelectedGroupMemberRepos(grown, null).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
      'd'
    ])
  })

  it('narrows to the picked repos, preserving group order', () => {
    expect(resolveSelectedGroupMemberRepos(repos, new Set(['c', 'a'])).map((r) => r.id)).toEqual([
      'a',
      'c'
    ])
  })

  it('ignores ids that are not in the group', () => {
    expect(resolveSelectedGroupMemberRepos(repos, new Set(['b', 'zzz'])).map((r) => r.id)).toEqual([
      'b'
    ])
  })

  it('falls back to the whole group when no id matches', () => {
    // A selection left over from another group; an empty container is the worse outcome.
    expect(resolveSelectedGroupMemberRepos(repos, new Set(['zzz'])).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c'
    ])
  })
})

describe('isStaleGroupMemberSelection', () => {
  it('treats sticky-all as never stale', () => {
    expect(isStaleGroupMemberSelection(repos, null)).toBe(false)
  })

  it('is fresh while any picked repo is still on offer', () => {
    expect(isStaleGroupMemberSelection(repos, new Set(['b', 'zzz']))).toBe(false)
  })

  it('is stale once none of the picked repos are on offer', () => {
    expect(isStaleGroupMemberSelection(repos, new Set(['zzz']))).toBe(true)
  })
})
