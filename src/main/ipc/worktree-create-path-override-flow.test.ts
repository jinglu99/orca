import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WorktreeLogic from './worktree-logic'
import {
  listWorktreesMock,
  addWorktreeMock,
  getBranchConflictKindMock,
  computeWorktreePathMock
} from './worktrees-test-module-mocks'
import { handlers, setupWorktreeHandlers } from './worktrees-test-harness'

vi.mock('electron', async () =>
  (await import('./worktrees-test-module-mocks')).electronModuleMock()
)
vi.mock('../git/worktree', async () =>
  (await import('./worktrees-test-module-mocks')).gitWorktreeModuleMock()
)
vi.mock('../git/runner', async () =>
  (await import('./worktrees-test-module-mocks')).gitRunnerModuleMock()
)
vi.mock('../git/repo', async () =>
  (await import('./worktrees-test-module-mocks')).gitRepoModuleMock()
)
vi.mock('../git/git-username', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveLocalGitUsername: (await import('./worktrees-test-module-mocks'))
    .resolveLocalGitUsernameMock
}))
vi.mock('../github/client', async () =>
  (await import('./worktrees-test-module-mocks')).githubClientModuleMock()
)
vi.mock('../source-control/hosted-review', async () =>
  (await import('./worktrees-test-module-mocks')).hostedReviewModuleMock()
)
vi.mock('../providers/ssh-git-dispatch', async () =>
  (await import('./worktrees-test-module-mocks')).sshGitDispatchModuleMock()
)
vi.mock('../providers/ssh-filesystem-dispatch', async () =>
  (await import('./worktrees-test-module-mocks')).sshFilesystemDispatchModuleMock()
)
vi.mock('./worktree-symlinks', async () =>
  (await import('./worktrees-test-module-mocks')).worktreeSymlinksModuleMock()
)
vi.mock('./ssh', async () => (await import('./worktrees-test-module-mocks')).sshModuleMock())
vi.mock('../ssh/ssh-target-registry', async () =>
  (await import('./worktrees-test-module-mocks')).sshTargetRegistryModuleMock()
)
vi.mock('../hooks', async () => (await import('./worktrees-test-module-mocks')).hooksModuleMock())
vi.mock('../setup-runner-script-text', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).setupRunnerScriptTextModuleMock(
    await importOriginal<Record<string, unknown>>()
  )
)
vi.mock('../worktree-runner-script', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).worktreeRunnerScriptModuleMock(
    await importOriginal<Record<string, unknown>>()
  )
)
vi.mock('../effective-hook-config', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).effectiveHookConfigModuleMock(
    await importOriginal<Record<string, unknown>>()
  )
)
vi.mock('../setup-hook-env-vars', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).setupHookEnvVarsModuleMock(
    await importOriginal<Record<string, unknown>>()
  )
)
vi.mock('./worktree-logic', async (importOriginal) => {
  const actual = await importOriginal<typeof WorktreeLogic>()
  return {
    ...(await import('./worktrees-test-module-mocks')).worktreeLogicModuleMock(actual),
    computeWorkspaceRootAsync: vi.fn(actual.computeWorkspaceRootAsync)
  }
})
vi.mock('../terminal-history-deletion', async () =>
  (await import('./worktrees-test-module-mocks')).terminalHistoryDeletionModuleMock()
)
vi.mock('../ports/advertised-url-watcher', async () =>
  (await import('./worktrees-test-module-mocks')).advertisedUrlWatcherModuleMock()
)
vi.mock('../workspace-cleanup-scan-snapshot', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceCleanupScanSnapshotModuleMock()
)
vi.mock('../workspace-space-analysis-snapshot', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceSpaceAnalysisSnapshotModuleMock()
)
vi.mock('../workspace-cleanup-removal-snapshot-prune', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceCleanupRemovalSnapshotPruneModuleMock()
)
vi.mock('../runtime/worktree-teardown', async () =>
  (await import('./worktrees-test-module-mocks')).worktreeTeardownModuleMock()
)
vi.mock('./pty', async () => (await import('./worktrees-test-module-mocks')).ptyModuleMock())

// The harness settings put the workspace root at /workspace with the repo at /workspace/repo,
// so an override under /workspace is inside the root and anything else is outside it.
describe('worktrees:create with worktreePathOverride', () => {
  beforeEach(() => {
    setupWorktreeHandlers()
  })

  it('checks out into the pinned path instead of the derived layout', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/payments/login/api',
        head: 'abc123',
        branch: 'login',
        isBare: false,
        isMainWorktree: false
      }
    ])

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'login',
      worktreePathOverride: '/workspace/payments/login/api'
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/payments/login/api',
      'login',
      'origin/main',
      false,
      false,
      {}
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({ path: '/workspace/payments/login/api' })
    })
  })

  it('resolves a workspace-root-relative override', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/payments/login/api',
        head: 'abc123',
        branch: 'login',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'login',
      worktreePathOverride: 'payments/login/api'
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/payments/login/api',
      'login',
      'origin/main',
      false,
      false,
      {}
    )
  })

  it('refuses an override that escapes the workspace root', async () => {
    await expect(
      handlers['worktrees:create'](null, {
        repoId: 'repo-1',
        name: 'login',
        worktreePathOverride: '/workspace/../etc/cron.d/payload'
      })
    ).rejects.toThrow(/inside/)
    expect(addWorktreeMock).not.toHaveBeenCalled()
  })

  it('keeps suffixing the branch while the pinned path stays fixed', async () => {
    // Why: only the path is the caller's to pin; a colliding branch must still slide to -2, or a
    // group create would fail whenever one member repo already has the branch.
    getBranchConflictKindMock.mockImplementation(async (_repoPath: string, branch: string) =>
      branch === 'login' ? 'remote' : null
    )
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/payments/login/api',
        head: 'abc123',
        branch: 'login-2',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'login',
      worktreePathOverride: '/workspace/payments/login/api'
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/payments/login/api',
      'login-2',
      'origin/main',
      false,
      false,
      {}
    )
  })

  it('leaves the derived layout in charge when no override is passed', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/login',
        head: 'abc123',
        branch: 'login',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, { repoId: 'repo-1', name: 'login' })

    expect(computeWorktreePathMock).toHaveBeenCalled()
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/login',
      'login',
      'origin/main',
      false,
      false,
      {}
    )
  })
})
