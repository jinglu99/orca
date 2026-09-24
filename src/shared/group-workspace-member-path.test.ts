import { describe, expect, it } from 'vitest'
import { planGroupWorkspaceMemberPaths } from './group-workspace-member-path'

const container = '/home/u/orca/workspaces/payments/login'

describe('planGroupWorkspaceMemberPaths', () => {
  it('places each repo under the container by its directory name', () => {
    expect(
      planGroupWorkspaceMemberPaths(container, [
        { id: 'a', path: '/src/payments/api' },
        { id: 'b', path: '/src/payments/web' }
      ])
    ).toEqual([
      { repoId: 'a', segment: 'api', path: `${container}/api` },
      { repoId: 'b', segment: 'web', path: `${container}/web` }
    ])
  })

  it('suffixes repos whose directories share a name so neither loses its own directory', () => {
    expect(
      planGroupWorkspaceMemberPaths(container, [
        { id: 'a', path: '/src/web/api' },
        { id: 'b', path: '/src/mobile/api' },
        { id: 'c', path: '/src/admin/api' }
      ]).map((placement) => placement.segment)
    ).toEqual(['api', 'api-2', 'api-3'])
  })

  it('does not let a suffixed name collide with a repo that already owns it', () => {
    expect(
      planGroupWorkspaceMemberPaths(container, [
        { id: 'a', path: '/src/web/api' },
        { id: 'b', path: '/src/other/api-2' },
        { id: 'c', path: '/src/mobile/api' }
      ]).map((placement) => placement.segment)
    ).toEqual(['api', 'api-2', 'api-3'])
  })

  it('strips a bare repository suffix', () => {
    expect(
      planGroupWorkspaceMemberPaths(container, [{ id: 'a', path: '/src/payments/api.git' }])[0]
    ).toMatchObject({ segment: 'api' })
  })

  it('falls back to a fixed segment when a repo path has no basename to borrow', () => {
    expect(planGroupWorkspaceMemberPaths(container, [{ id: 'a', path: '/' }])[0]).toMatchObject({
      segment: 'repo',
      path: `${container}/repo`
    })
  })

  it('places members under a Windows container', () => {
    expect(
      planGroupWorkspaceMemberPaths('C:\\Users\\u\\orca\\workspaces\\payments\\login', [
        { id: 'a', path: 'C:\\src\\payments\\api' }
      ])[0]
    ).toMatchObject({ path: 'C:/Users/u/orca/workspaces/payments/login/api' })
  })

  it('returns nothing for an empty member set', () => {
    expect(planGroupWorkspaceMemberPaths(container, [])).toEqual([])
  })
})
