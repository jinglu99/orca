import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureOrcaAssistantWorkspace } from './orca-assistant-workspace'
import { ORCA_ASSISTANT_INSTRUCTIONS } from './orca-assistant-instructions'
import { orcaAssistantCodexConfigArgs } from './orca-assistant-mcp-config'

describe('ensureOrcaAssistantWorkspace', () => {
  let root: string | null = null

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true })
      root = null
    }
  })

  async function freshDir(): Promise<string> {
    root = await mkdtemp(path.join(tmpdir(), 'orca-assistant-'))
    return path.join(root, 'orca-assistant')
  }

  it('creates the folder with instructions every agent reads', async () => {
    const dir = await freshDir()

    await expect(ensureOrcaAssistantWorkspace(dir, null)).resolves.toBe(dir)

    await expect(readFile(path.join(dir, 'AGENTS.md'), 'utf8')).resolves.toBe(
      ORCA_ASSISTANT_INSTRUCTIONS
    )
    // Claude reads CLAUDE.md, so it imports the shared file rather than holding a second copy.
    await expect(readFile(path.join(dir, 'CLAUDE.md'), 'utf8')).resolves.toBe('@AGENTS.md\n')
  })

  it('restores stale instructions and leaves current ones untouched', async () => {
    const dir = await freshDir()
    await ensureOrcaAssistantWorkspace(dir, null)
    const claudeBefore = await stat(path.join(dir, 'CLAUDE.md'))
    await writeFile(path.join(dir, 'AGENTS.md'), 'edited by hand', 'utf8')

    await ensureOrcaAssistantWorkspace(dir, null)

    await expect(readFile(path.join(dir, 'AGENTS.md'), 'utf8')).resolves.toBe(
      ORCA_ASSISTANT_INSTRUCTIONS
    )
    expect((await stat(path.join(dir, 'CLAUDE.md'))).mtimeMs).toBe(claudeBefore.mtimeMs)
  })

  it("registers this app's CLI as a pre-approved MCP server", async () => {
    const dir = await freshDir()

    await ensureOrcaAssistantWorkspace(dir, {
      launcher: '/Applications/Orca.app/Contents/Resources/bin/orca',
      userDataPath: '/profiles/orca'
    })

    expect(JSON.parse(await readFile(path.join(dir, '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        orca: {
          type: 'stdio',
          command: '/Applications/Orca.app/Contents/Resources/bin/orca',
          args: ['mcp', 'serve'],
          env: { ORCA_USER_DATA_PATH: '/profiles/orca' }
        }
      }
    })
    const settings = JSON.parse(
      await readFile(path.join(dir, '.claude', 'settings.local.json'), 'utf8')
    )
    expect(settings.enabledMcpjsonServers).toEqual(['orca'])
    // Reads run unprompted; creating worktrees and messaging agents still ask.
    expect(settings.permissions.allow).toContain('mcp__orca__list_worktrees')
    expect(settings.permissions.allow).not.toContain('mcp__orca__send_to_agent')
    expect(settings.permissions.allow).not.toContain('mcp__orca__create_worktree')
  })

  it('leaves MCP out when this app has no CLI launcher', async () => {
    const dir = await freshDir()

    await ensureOrcaAssistantWorkspace(dir, null)

    await expect(stat(path.join(dir, '.mcp.json'))).rejects.toThrow()
  })
})

describe('orcaAssistantCodexConfigArgs', () => {
  it('registers the same orca server for Codex through launch overrides', () => {
    expect(
      orcaAssistantCodexConfigArgs({
        launcher: '/Apps/Orca "dev"/orca',
        userDataPath: '/profiles/orca'
      })
    ).toEqual([
      '-c',
      'mcp_servers.orca.command="/Apps/Orca \\"dev\\"/orca"',
      '-c',
      'mcp_servers.orca.args=["mcp","serve"]',
      '-c',
      'mcp_servers.orca.env={ ORCA_USER_DATA_PATH = "/profiles/orca" }'
    ])
  })
})
