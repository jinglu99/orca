import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyAgentWorkspaceTrust = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('../agent-workspace-trust', () => ({ applyAgentWorkspaceTrust }))
vi.mock('../orca-assistant/orca-assistant-workspace', () => ({
  ensureOrcaAssistantWorkspace: vi.fn(async () => '/user-data/orca-assistant')
}))

import { OrcaRuntimeService } from './orca-runtime'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../shared/constants'
import { ORCA_ASSISTANT_LAUNCH_DIRECTORY } from '../../shared/orca-assistant-session'
import { structuredAgentSessionCreateIntentFingerprint } from './rpc/methods/structured-agent-session-create'

beforeEach(() => {
  applyAgentWorkspaceTrust.mockClear()
})

function createIntentRuntime(workspaceId: string) {
  const runtime = new OrcaRuntimeService(
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create intent only reads getSettings from the store.
    { getSettings: () => ({ agentDefaultEnv: { codex: {} } }) } as never,
    undefined,
    { prepareCodexStructuredLaunch: vi.fn(() => '/accounts/home') }
  )
  vi.spyOn(runtime, 'getStructuredAgentSessionCreateSupport').mockResolvedValue({
    supported: true
  })
  Object.assign(runtime, {
    resolveStructuredAgentSessionLocation: vi.fn(async () => ({
      executionHostId: 'local',
      wslDistro: null,
      workspaceId,
      workspaceKind: 'folder' as const
    })),
    resolveRuntimeFileTarget: vi.fn(async () => ({ worktree: { path: '/host/floating-folder' } }))
  })
  return (launchDirectory?: typeof ORCA_ASSISTANT_LAUNCH_DIRECTORY) =>
    runtime.resolveStructuredAgentSessionCreateIntent({
      envelope: { sessionId: 'session-1', clientOperationId: 'operation-1' },
      worktree: `id:${workspaceId}`,
      agent: 'codex',
      ...(launchDirectory ? { launchDirectory } : {})
    })
}

describe('Orca assistant chat create intent', () => {
  it('launches in the assistant folder and trusts that folder, not the floating one', async () => {
    const createIntent = createIntentRuntime(FLOATING_TERMINAL_WORKTREE_ID)

    const intent = await createIntent(ORCA_ASSISTANT_LAUNCH_DIRECTORY)

    expect(intent.hostLaunchDirectory).toBe('/user-data/orca-assistant')
    expect(applyAgentWorkspaceTrust).toHaveBeenCalledWith(
      'codex',
      '/user-data/orca-assistant',
      expect.anything()
    )
  })

  it('refuses an assistant chat outside the floating workspace', async () => {
    const createIntent = createIntentRuntime('repo-1::/repos/one')

    await expect(createIntent(ORCA_ASSISTANT_LAUNCH_DIRECTORY)).rejects.toThrow()
  })

  it('digests the assistant folder, so a plain create never replays as an assistant one', () => {
    const base = {
      envelope: {
        sessionId: 'claude_1',
        clientOperationId: 'op-1',
        expectedRuntimeFence: null,
        payloadFingerprint: ''
      },
      worktree: `id:${FLOATING_TERMINAL_WORKTREE_ID}`,
      agent: 'claude'
    }
    expect(
      structuredAgentSessionCreateIntentFingerprint({
        ...base,
        launchDirectory: ORCA_ASSISTANT_LAUNCH_DIRECTORY
      })
    ).not.toBe(structuredAgentSessionCreateIntentFingerprint(base))
  })
})
