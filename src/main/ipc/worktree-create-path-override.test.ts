import { describe, expect, it } from 'vitest'
import { resolveWorktreeCreatePathOverride } from './worktree-create-path-override'

describe('resolveWorktreeCreatePathOverride', () => {
  it('accepts an absolute path nested inside the workspace root', () => {
    expect(
      resolveWorktreeCreatePathOverride(
        '/home/u/orca/workspaces/group/login/api',
        '/home/u/orca/workspaces'
      )
    ).toBe('/home/u/orca/workspaces/group/login/api')
  })

  it('resolves a relative override against the workspace root', () => {
    expect(resolveWorktreeCreatePathOverride('group/login/api', '/home/u/orca/workspaces')).toBe(
      '/home/u/orca/workspaces/group/login/api'
    )
  })

  it('collapses dot segments that stay inside the root', () => {
    expect(
      resolveWorktreeCreatePathOverride(
        '/home/u/orca/workspaces/group/../login',
        '/home/u/orca/workspaces'
      )
    ).toBe('/home/u/orca/workspaces/login')
  })

  it('rejects an absolute path outside the workspace root', () => {
    expect(() =>
      resolveWorktreeCreatePathOverride('/etc/cron.d/payload', '/home/u/orca/workspaces')
    ).toThrow(/inside/)
  })

  it('rejects a traversal that escapes the root through dot segments', () => {
    // Why this case: the comparison keys fold separators and case but not `..`, so a raw prefix
    // test would accept this path.
    expect(() =>
      resolveWorktreeCreatePathOverride(
        '/home/u/orca/workspaces/../../.ssh',
        '/home/u/orca/workspaces'
      )
    ).toThrow(/inside/)
  })

  it('rejects a relative traversal that escapes the root', () => {
    expect(() =>
      resolveWorktreeCreatePathOverride('../../.ssh', '/home/u/orca/workspaces')
    ).toThrow(/inside/)
  })

  it('rejects the workspace root itself', () => {
    expect(() =>
      resolveWorktreeCreatePathOverride('/home/u/orca/workspaces', '/home/u/orca/workspaces')
    ).toThrow(/inside/)
  })

  it('rejects a sibling directory that only shares a name prefix with the root', () => {
    expect(() =>
      resolveWorktreeCreatePathOverride(
        '/home/u/orca/workspaces-evil/api',
        '/home/u/orca/workspaces'
      )
    ).toThrow(/inside/)
  })

  it('rejects an empty or blank override', () => {
    expect(() => resolveWorktreeCreatePathOverride('   ', '/home/u/orca/workspaces')).toThrow(
      /must not be empty/
    )
  })

  it('confines a Windows override to its drive-qualified root', () => {
    expect(
      resolveWorktreeCreatePathOverride(
        'C:\\Users\\u\\orca\\workspaces\\group\\login\\api',
        'C:\\Users\\u\\orca\\workspaces'
      )
    ).toBe('C:/Users/u/orca/workspaces/group/login/api')
    expect(() =>
      resolveWorktreeCreatePathOverride('C:\\Windows\\System32', 'C:\\Users\\u\\orca\\workspaces')
    ).toThrow(/inside/)
  })

  it('confines a WSL UNC override to its distro root', () => {
    expect(
      resolveWorktreeCreatePathOverride(
        '//wsl.localhost/Ubuntu/home/u/orca/workspaces/group/api',
        '//wsl.localhost/Ubuntu/home/u/orca/workspaces'
      )
    ).toBe('//wsl.localhost/Ubuntu/home/u/orca/workspaces/group/api')
    expect(() =>
      resolveWorktreeCreatePathOverride(
        '//wsl.localhost/Debian/home/u/orca/workspaces/group/api',
        '//wsl.localhost/Ubuntu/home/u/orca/workspaces'
      )
    ).toThrow(/inside/)
  })
})
