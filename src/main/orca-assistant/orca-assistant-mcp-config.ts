// Registers `orca mcp serve` as the assistant folder's project MCP server, pre-approved so the
// agent never stops at an "allow this server?" prompt. Read-only tools are allow-listed; anything
// that changes state still asks the user.

import { ORCA_MCP_TOOLS } from '../../shared/orca-mcp-tools'

export const ORCA_ASSISTANT_MCP_SERVER_NAME = 'orca'

export type OrcaAssistantCli = {
  /** Absolute path of this app's CLI launcher. */
  launcher: string
  /** Pins the CLI to this Orca instance, which matters for dev builds and custom profiles. */
  userDataPath: string
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function orcaAssistantMcpFiles(
  cli: OrcaAssistantCli
): readonly (readonly [name: string, content: string])[] {
  const mcpConfig = {
    mcpServers: {
      [ORCA_ASSISTANT_MCP_SERVER_NAME]: {
        type: 'stdio',
        command: cli.launcher,
        args: ['mcp', 'serve'],
        env: { ORCA_USER_DATA_PATH: cli.userDataPath }
      }
    }
  }
  const claudeSettings = {
    enabledMcpjsonServers: [ORCA_ASSISTANT_MCP_SERVER_NAME],
    permissions: {
      allow: ORCA_MCP_TOOLS.filter((tool) => tool.readOnly).map(
        (tool) => `mcp__${ORCA_ASSISTANT_MCP_SERVER_NAME}__${tool.name}`
      )
    }
  }
  return [
    ['.mcp.json', json(mcpConfig)],
    // Why local settings: Claude honours MCP approvals from them without a trust prompt, and they
    // stay this machine's, like the absolute launcher path they pair with.
    ['.claude/settings.local.json', json(claudeSettings)]
  ]
}

/** TOML basic string; JSON's escapes are a subset TOML reads the same way. */
function tomlString(value: string): string {
  return JSON.stringify(value)
}

/**
 * The same `orca` server for Codex, which takes MCP servers from its config rather than a project
 * file: `-c` overrides on the launch, so the user's `config.toml` is never written.
 */
export function orcaAssistantCodexConfigArgs(cli: OrcaAssistantCli): string[] {
  const server = `mcp_servers.${ORCA_ASSISTANT_MCP_SERVER_NAME}`
  return [
    '-c',
    `${server}.command=${tomlString(cli.launcher)}`,
    '-c',
    `${server}.args=["mcp","serve"]`,
    '-c',
    `${server}.env={ ORCA_USER_DATA_PATH = ${tomlString(cli.userDataPath)} }`
  ]
}
