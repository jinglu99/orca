import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const MCP_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['mcp', 'serve'],
    summary: 'Serve Orca tools to an agent over MCP (stdio)',
    usage: 'orca mcp serve',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Speaks the Model Context Protocol on stdin/stdout; register it as a stdio MCP server rather than running it by hand.',
      'Each tool runs the matching orca command with --json against this Orca instance.'
    ],
    examples: ['claude mcp add orca -- orca mcp serve']
  }
]
