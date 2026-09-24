// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { GroupMemberRepoField } from './GroupMemberRepoField'

function repo(id: string): Repo {
  return { id, path: `/src/${id}`, displayName: id, badgeColor: '#000000', addedAt: 0, kind: 'git' }
}

const repos = [repo('api'), repo('web'), repo('admin')]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(node: React.ReactElement): void {
  act(() => {
    root.render(node)
  })
}

describe('GroupMemberRepoField', () => {
  it('reads sticky-all as every repo selected', () => {
    render(
      <GroupMemberRepoField
        repos={repos}
        selectedRepoIds={null}
        onSelectedRepoIdsChange={vi.fn()}
      />
    )

    // Why assert the trigger text: sticky-all must not render as "0 selected" just because the
    // caller stores it as null rather than a full set.
    expect(container.textContent).toContain('All projects')
  })

  it('names the picked repos when the selection is narrowed', () => {
    render(
      <GroupMemberRepoField
        repos={repos}
        selectedRepoIds={new Set(['api', 'web'])}
        onSelectedRepoIdsChange={vi.fn()}
      />
    )

    expect(container.textContent).toContain('api')
    expect(container.textContent).toContain('web')
    expect(container.textContent).not.toContain('All projects')
  })

  it('explains that each selected repo gets its own worktree', () => {
    render(
      <GroupMemberRepoField
        repos={repos}
        selectedRepoIds={null}
        onSelectedRepoIdsChange={vi.fn()}
      />
    )

    expect(container.textContent).toContain('own worktree')
  })

  it('renders a trigger the user can open', () => {
    render(
      <GroupMemberRepoField
        repos={repos}
        selectedRepoIds={null}
        onSelectedRepoIdsChange={vi.fn()}
      />
    )

    const trigger = container.querySelector('button[role="combobox"]')
    expect(trigger).not.toBeNull()
    expect(trigger?.getAttribute('aria-expanded')).toBe('false')
  })
})
