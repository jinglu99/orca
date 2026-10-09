// The Orca assistant's typed tools. Each one is an existing `orca` subcommand run with --json, so a
// tool inherits that command's validation, prompt-delivery preflight and recovery hints unchanged.

type JsonSchemaProperty = {
  type: 'string' | 'integer' | 'boolean'
  description: string
  minimum?: number
  maximum?: number
}

export type OrcaMcpTool = {
  name: string
  title: string
  description: string
  /** Reads Orca state only; agent hosts may run these without asking. */
  readOnly: boolean
  inputSchema: {
    type: 'object'
    properties: Record<string, JsonSchemaProperty>
    required?: string[]
    additionalProperties: false
  }
  /** CLI arguments after the executable, without --json. Throws OrcaMcpArgumentError on bad input. */
  toArgv: (args: Record<string, unknown>) => string[]
}

export class OrcaMcpArgumentError extends Error {}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new OrcaMcpArgumentError(`"${key}" must be a non-empty string`)
  }
  return value
}

function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new OrcaMcpArgumentError(`"${key}" must be a string`)
  }
  return value
}

function optionalPositiveInteger(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key]
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new OrcaMcpArgumentError(`"${key}" must be a positive integer`)
  }
  return value
}

function flag(name: string, value: string | number | undefined): string[] {
  return value === undefined ? [] : [`--${name}`, String(value)]
}

const WORKTREE_SELECTOR_HELP =
  'Worktree selector: id:<repoId>::<path> (the id from list_worktrees), name:<displayName>, path:<absolutePath> or branch:<branchName>.'
const TERMINAL_HANDLE_HELP = 'Terminal handle as listed by list_terminals or list_worktrees.'

export const ORCA_MCP_TOOLS: readonly OrcaMcpTool[] = [
  {
    name: 'orca_status',
    title: 'Orca status',
    description: 'Check that Orca is running and its runtime is reachable.',
    readOnly: true,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    toArgv: () => ['status']
  },
  {
    name: 'list_repos',
    title: 'List projects',
    description: 'List the projects (repositories and folders) added to Orca.',
    readOnly: true,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    toArgv: () => ['repo', 'list']
  },
  {
    name: 'list_worktrees',
    title: 'List worktrees and agents',
    description:
      'List worktrees with their live agents: agent type, state (working, waiting, blocked, done), latest prompt, last message and terminal handles. Start here for "what are my agents doing".',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, description: 'Maximum worktrees to return.' }
      },
      additionalProperties: false
    },
    toArgv: (args) => ['worktree', 'ps', ...flag('limit', optionalPositiveInteger(args, 'limit'))]
  },
  {
    name: 'show_worktree',
    title: 'Show worktree',
    description: 'Show one worktree: branch, path, linked items and status.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: { worktree: { type: 'string', description: WORKTREE_SELECTOR_HELP } },
      required: ['worktree'],
      additionalProperties: false
    },
    toArgv: (args) => ['worktree', 'show', '--worktree', requiredString(args, 'worktree')]
  },
  {
    name: 'list_terminals',
    title: 'List terminals',
    description: 'List terminals, optionally only those in one worktree.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: { worktree: { type: 'string', description: WORKTREE_SELECTOR_HELP } },
      additionalProperties: false
    },
    toArgv: (args) => ['terminal', 'list', ...flag('worktree', optionalString(args, 'worktree'))]
  },
  {
    name: 'read_terminal',
    title: 'Read terminal',
    description:
      "Read a terminal's recent output, e.g. to see what an agent did or is asking. Set screen to read only what is currently rendered.",
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        terminal: { type: 'string', description: TERMINAL_HANDLE_HELP },
        limit: { type: 'integer', minimum: 1, description: 'Maximum lines to return.' },
        screen: { type: 'boolean', description: 'Read the currently rendered screen instead.' }
      },
      required: ['terminal'],
      additionalProperties: false
    },
    toArgv: (args) => [
      'terminal',
      'read',
      '--terminal',
      requiredString(args, 'terminal'),
      ...flag('limit', optionalPositiveInteger(args, 'limit')),
      ...(args.screen === true ? ['--screen'] : [])
    ]
  },
  {
    name: 'wait_for_agent',
    title: 'Wait for agent',
    description:
      'Wait until the agent in a terminal goes idle or stops to ask for input. The result says which, and why it is blocked if it is.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        terminal: { type: 'string', description: TERMINAL_HANDLE_HELP },
        timeout_seconds: {
          type: 'integer',
          minimum: 1,
          maximum: 600,
          description: 'Give up after this many seconds (default 120).'
        }
      },
      required: ['terminal'],
      additionalProperties: false
    },
    toArgv: (args) => [
      'terminal',
      'wait',
      '--terminal',
      requiredString(args, 'terminal'),
      '--for',
      'tui-idle',
      '--timeout-ms',
      String((optionalPositiveInteger(args, 'timeout_seconds') ?? 120) * 1000)
    ]
  },
  {
    name: 'create_worktree',
    title: 'Create worktree',
    description:
      'Create a worktree in a project, optionally starting an agent in it with a prompt. Use this to hand a task to a new agent.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Project selector as listed by list_repos.' },
        name: { type: 'string', description: 'Worktree and branch name, e.g. fix-login-redirect.' },
        base_branch: {
          type: 'string',
          description: 'Branch to start from; defaults to the project default.'
        },
        agent: {
          type: 'string',
          description: 'Agent to start in the new worktree, e.g. claude or codex.'
        },
        prompt: { type: 'string', description: 'Task for the agent; requires agent.' }
      },
      required: ['repo', 'name'],
      additionalProperties: false
    },
    toArgv: (args) => {
      const agent = optionalString(args, 'agent')
      const prompt = optionalString(args, 'prompt')
      if (prompt !== undefined && agent === undefined) {
        throw new OrcaMcpArgumentError('"prompt" requires "agent"')
      }
      return [
        'worktree',
        'create',
        '--repo',
        requiredString(args, 'repo'),
        '--name',
        requiredString(args, 'name'),
        ...flag('base-branch', optionalString(args, 'base_branch')),
        // Why: the assistant runs in the floating workspace, which must never become the new
        // worktree's parent; lineage would otherwise point at a folder that is not a project.
        '--no-parent',
        ...flag('agent', agent),
        ...flag('prompt', prompt)
      ]
    }
  },
  {
    name: 'send_to_agent',
    title: 'Send message to agent',
    description:
      'Send a message to the agent running in a terminal and submit it, as if the user typed it there.',
    readOnly: false,
    inputSchema: {
      type: 'object',
      properties: {
        terminal: { type: 'string', description: TERMINAL_HANDLE_HELP },
        text: { type: 'string', description: 'The message to submit.' }
      },
      required: ['terminal', 'text'],
      additionalProperties: false
    },
    toArgv: (args) => [
      'terminal',
      'send',
      '--terminal',
      requiredString(args, 'terminal'),
      '--text',
      requiredString(args, 'text'),
      '--enter'
    ]
  }
]
