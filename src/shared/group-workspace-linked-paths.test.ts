import { describe, expect, it } from 'vitest'
import { planGroupWorkspaceLinkedPaths } from './group-workspace-linked-paths'

const groupParentPath = '/src/platform'

function plan(overrides: Partial<Parameters<typeof planGroupWorkspaceLinkedPaths>[0]> = {}) {
  return planGroupWorkspaceLinkedPaths({
    groupParentPath,
    groupRootEntries: [],
    memberRepoPaths: [],
    folderProjectPaths: [],
    ...overrides
  })
}

describe('planGroupWorkspaceLinkedPaths', () => {
  it('links the agent instructions the group root actually has', () => {
    expect(plan({ groupRootEntries: ['CLAUDE.md', '.claude', 'api', 'README.md'] })).toEqual([
      'CLAUDE.md',
      '.claude'
    ])
  })

  it('does not invent agent files the group root lacks', () => {
    expect(plan({ groupRootEntries: ['api', 'web'] })).toEqual([])
  })

  it('links registered non-git projects', () => {
    expect(
      plan({
        groupRootEntries: ['docs', 'database', 'tmp'],
        folderProjectPaths: ['/src/platform/docs', '/src/platform/database']
      })
    ).toEqual(['docs', 'database'])
  })

  it('leaves unregistered scratch directories alone', () => {
    // Why this is the whole point of the registration filter: a group root collects tmp, log and
    // downloads, and none of that belongs in every workspace.
    expect(
      plan({
        groupRootEntries: ['docs', 'tmp', 'log', 'hotspot_doc.zip', '.DS_Store'],
        folderProjectPaths: ['/src/platform/docs']
      })
    ).toEqual(['docs'])
  })

  it('never links over a member repo, even if it is also registered as a folder', () => {
    // A worktree already owns that name in the container; linking the source over it would undo
    // the isolation the workspace exists for.
    expect(
      plan({
        groupRootEntries: ['api', 'CLAUDE.md'],
        memberRepoPaths: ['/src/platform/api'],
        folderProjectPaths: ['/src/platform/api']
      })
    ).toEqual(['CLAUDE.md'])
  })

  it('skips a registered folder that lives outside the group root', () => {
    expect(
      plan({ groupRootEntries: ['docs'], folderProjectPaths: ['/elsewhere/vendor-docs'] })
    ).toEqual([])
  })

  it('skips a registered folder nested below the group root', () => {
    expect(
      plan({ groupRootEntries: ['docs'], folderProjectPaths: ['/src/platform/docs/internal'] })
    ).toEqual([])
  })

  it('emits each entry once', () => {
    expect(
      plan({
        groupRootEntries: ['docs', 'CLAUDE.md'],
        folderProjectPaths: ['/src/platform/docs', '/src/platform/docs']
      })
    ).toEqual(['CLAUDE.md', 'docs'])
  })

  it('plans nothing for a group root with only member repos', () => {
    expect(
      plan({ groupRootEntries: ['api', 'web'], memberRepoPaths: ['/src/platform/api'] })
    ).toEqual([])
  })
})
