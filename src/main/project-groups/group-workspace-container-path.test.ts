import { describe, expect, it } from 'vitest'
import {
  computeGroupWorkspaceContainerPath,
  resolveGroupWorkspaceRoot
} from './group-workspace-container-path'

const group = { name: 'payments', parentPath: '/src/payments' }

describe('computeGroupWorkspaceContainerPath', () => {
  it('lays the container out workspace-major under an absolute workspace root', () => {
    expect(
      computeGroupWorkspaceContainerPath({
        group,
        workspaceName: 'login',
        workspaceDir: '/home/u/orca/workspaces'
      })
    ).toBe('/home/u/orca/workspaces/payments/login')
  })

  it('anchors a repo-relative workspace root on the group parent folder', () => {
    expect(
      computeGroupWorkspaceContainerPath({
        group,
        workspaceName: 'login',
        workspaceDir: '../worktrees'
      })
    ).toBe('/src/worktrees/payments/login')
  })

  it('sanitizes both segments so a name cannot add path separators', () => {
    expect(
      computeGroupWorkspaceContainerPath({
        group: { name: 'pay/ments', parentPath: '/src/payments' },
        workspaceName: '../../escape',
        workspaceDir: '/home/u/orca/workspaces'
      })
    ).toBe('/home/u/orca/workspaces/pay-ments/escape')
  })

  it('keeps non-ASCII workspace names intact', () => {
    expect(
      computeGroupWorkspaceContainerPath({
        group,
        workspaceName: '登录重构',
        workspaceDir: '/home/u/orca/workspaces'
      })
    ).toBe('/home/u/orca/workspaces/payments/登录重构')
  })

  it('lays out a Windows container under its drive-qualified root', () => {
    expect(
      computeGroupWorkspaceContainerPath({
        group: { name: 'payments', parentPath: 'C:\\src\\payments' },
        workspaceName: 'login',
        workspaceDir: 'C:\\Users\\u\\orca\\workspaces'
      })
    ).toBe('C:/Users/u/orca/workspaces/payments/login')
  })

  it('refuses a workspace name that sanitizes to nothing', () => {
    expect(() =>
      computeGroupWorkspaceContainerPath({
        group,
        workspaceName: '...',
        workspaceDir: '/home/u/orca/workspaces'
      })
    ).toThrow(/Invalid worktree name/)
  })
})

describe('resolveGroupWorkspaceRoot', () => {
  it('refuses a relative root for a group with no parent folder to anchor it', () => {
    // Why: a manually built group can have repos scattered across the disk, so there is no
    // anchor and resolving against the app cwd would scatter containers somewhere arbitrary.
    expect(() =>
      resolveGroupWorkspaceRoot({ name: 'ad-hoc', parentPath: null }, '../worktrees')
    ).toThrow('group_workspace_root_unanchored')
  })

  it('accepts an absolute root for a group with no parent folder', () => {
    expect(
      resolveGroupWorkspaceRoot({ name: 'ad-hoc', parentPath: null }, '/home/u/orca/workspaces')
    ).toBe('/home/u/orca/workspaces')
  })

  it('refuses a blank root', () => {
    expect(() => resolveGroupWorkspaceRoot(group, '   ')).toThrow('group_workspace_root_unset')
  })
})

describe('resolveGroupWorkspaceRoot on a remote group', () => {
  it('refuses a desktop-absolute root for an SSH-backed group', () => {
    expect(() =>
      resolveGroupWorkspaceRoot(
        { name: 'payments', parentPath: '/srv/src/payments' },
        '/Users/me/orca/workspaces',
        'ssh-target-1'
      )
    ).toThrow('group_workspace_root_not_on_execution_host')
  })

  it('accepts a group-relative root for an SSH-backed group', () => {
    expect(
      resolveGroupWorkspaceRoot(
        { name: 'payments', parentPath: '/srv/src/payments' },
        '../worktrees',
        'ssh-target-1'
      )
    ).toBe('/srv/src/worktrees')
  })
})
