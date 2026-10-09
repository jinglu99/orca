import { describe, expect, it } from 'vitest'
import { ORCA_MCP_TOOLS, OrcaMcpArgumentError } from './orca-mcp-tools'

function tool(name: string) {
  const found = ORCA_MCP_TOOLS.find((candidate) => candidate.name === name)
  if (!found) {
    throw new Error(`no tool ${name}`)
  }
  return found
}

describe('ORCA_MCP_TOOLS', () => {
  it('declares every required argument as a property', () => {
    for (const entry of ORCA_MCP_TOOLS) {
      for (const key of entry.inputSchema.required ?? []) {
        expect(entry.inputSchema.properties, `${entry.name}.${key}`).toHaveProperty(key)
      }
    }
  })

  it('maps reads onto the matching orca commands', () => {
    expect(tool('list_worktrees').toArgv({ limit: 5 })).toEqual(['worktree', 'ps', '--limit', '5'])
    expect(tool('read_terminal').toArgv({ terminal: 'term_1', screen: true })).toEqual([
      'terminal',
      'read',
      '--terminal',
      'term_1',
      '--screen'
    ])
    expect(tool('wait_for_agent').toArgv({ terminal: 'term_1' })).toEqual([
      'terminal',
      'wait',
      '--terminal',
      'term_1',
      '--for',
      'tui-idle',
      '--timeout-ms',
      '120000'
    ])
  })

  it('submits a message to an agent as a prompt', () => {
    expect(tool('send_to_agent').toArgv({ terminal: 'term_1', text: 'run the tests' })).toEqual([
      'terminal',
      'send',
      '--terminal',
      'term_1',
      '--text',
      'run the tests',
      '--enter'
    ])
  })

  it('creates worktrees without adopting the floating workspace as their parent', () => {
    expect(
      tool('create_worktree').toArgv({
        repo: 'orca',
        name: 'fix-login',
        agent: 'claude',
        prompt: 'Fix the login redirect'
      })
    ).toEqual([
      'worktree',
      'create',
      '--repo',
      'orca',
      '--name',
      'fix-login',
      '--no-parent',
      '--agent',
      'claude',
      '--prompt',
      'Fix the login redirect'
    ])
  })

  it('refuses arguments the command could not take', () => {
    expect(() => tool('show_worktree').toArgv({})).toThrow(OrcaMcpArgumentError)
    expect(() => tool('list_worktrees').toArgv({ limit: 0 })).toThrow(OrcaMcpArgumentError)
    expect(() => tool('create_worktree').toArgv({ repo: 'r', name: 'n', prompt: 'p' })).toThrow(
      '"prompt" requires "agent"'
    )
  })

  it('marks only state-changing tools as needing approval', () => {
    expect(ORCA_MCP_TOOLS.filter((entry) => !entry.readOnly).map((entry) => entry.name)).toEqual([
      'create_worktree',
      'send_to_agent'
    ])
  })
})
