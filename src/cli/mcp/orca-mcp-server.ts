// A minimal MCP server (stdio, newline-delimited JSON-RPC) exposing ORCA_MCP_TOOLS. Only the tool
// surface is implemented: initialize, ping, tools/list and tools/call.

import { createInterface } from 'node:readline'
import { ORCA_MCP_TOOLS, OrcaMcpArgumentError, type OrcaMcpTool } from '../../shared/orca-mcp-tools'

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602

export type OrcaCommandResult = { code: number | null; stdout: string; stderr: string }
export type RunOrcaCommand = (argv: string[]) => Promise<OrcaCommandResult>

type JsonRpcId = string | number
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId | null; error: { code: number; message: string } }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number'
}

function errorResponse(id: JsonRpcId | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function negotiateProtocolVersion(params: unknown): string {
  const requested = isRecord(params) ? params.protocolVersion : undefined
  return (
    SUPPORTED_PROTOCOL_VERSIONS.find((version) => version === requested) ??
    SUPPORTED_PROTOCOL_VERSIONS[0]
  )
}

function describeTool(tool: OrcaMcpTool): Record<string, unknown> {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, readOnlyHint: tool.readOnly, openWorldHint: false }
  }
}

function toolText(text: string, isError: boolean): Record<string, unknown> {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) }
}

class McpRequestError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message)
  }
}

async function callTool(params: unknown, runCommand: RunOrcaCommand): Promise<unknown> {
  const name = isRecord(params) ? params.name : undefined
  const tool = ORCA_MCP_TOOLS.find((candidate) => candidate.name === name)
  if (!tool) {
    throw new McpRequestError(INVALID_PARAMS, `Unknown tool: ${String(name)}`)
  }
  const rawArgs = isRecord(params) && isRecord(params.arguments) ? params.arguments : {}
  let argv: string[]
  try {
    argv = tool.toArgv(rawArgs)
  } catch (error) {
    if (error instanceof OrcaMcpArgumentError) {
      return toolText(`Invalid arguments: ${error.message}`, true)
    }
    throw error
  }
  const result = await runCommand([...argv, '--json'])
  if (result.code === 0) {
    return toolText(result.stdout.trim() || '{}', false)
  }
  // Why: the CLI reports --json failures as a JSON error object; pass it through so the model sees
  // the same error code and recovery hint a person would.
  const detail = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n')
  return toolText(detail || `orca exited with code ${String(result.code)}`, true)
}

function toolTextResponse(id: JsonRpcId, error: unknown): JsonRpcResponse {
  const reason = error instanceof Error ? error.message : String(error)
  return { jsonrpc: '2.0', id, result: toolText(`Could not run orca: ${reason}`, true) }
}

/** Answers one decoded JSON-RPC message; null for notifications, which get no reply. */
export async function handleOrcaMcpMessage(
  message: unknown,
  deps: { runCommand: RunOrcaCommand; version: string }
): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return errorResponse(
      isRecord(message) && isJsonRpcId(message.id) ? message.id : null,
      INVALID_REQUEST,
      'Invalid JSON-RPC request'
    )
  }
  if (!isJsonRpcId(message.id)) {
    return null
  }
  const id = message.id
  try {
    switch (message.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: negotiateProtocolVersion(message.params),
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'orca', title: 'Orca', version: deps.version }
          }
        }
      case 'ping':
        return { jsonrpc: '2.0', id, result: {} }
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: ORCA_MCP_TOOLS.map(describeTool) } }
      case 'tools/call':
        return { jsonrpc: '2.0', id, result: await callTool(message.params, deps.runCommand) }
      default:
        return errorResponse(id, METHOD_NOT_FOUND, `Method not found: ${message.method}`)
    }
  } catch (error) {
    if (error instanceof McpRequestError) {
      return errorResponse(id, error.code, error.message)
    }
    return toolTextResponse(id, error)
  }
}

/** Serves until stdin closes, answering requests concurrently so a long wait blocks nothing. */
export async function serveOrcaMcpOverStdio(deps: {
  runCommand: RunOrcaCommand
  version: string
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
}): Promise<void> {
  const output = deps.output ?? process.stdout
  const lines = createInterface({ input: deps.input ?? process.stdin, crlfDelay: Infinity })
  const inFlight = new Set<Promise<void>>()
  const write = (response: JsonRpcResponse | null): void => {
    if (response) {
      output.write(`${JSON.stringify(response)}\n`)
    }
  }
  for await (const line of lines) {
    if (line.trim() === '') {
      continue
    }
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      write(errorResponse(null, PARSE_ERROR, 'Parse error'))
      continue
    }
    const pending = handleOrcaMcpMessage(message, deps).then(write)
    inFlight.add(pending)
    void pending.finally(() => inFlight.delete(pending))
  }
  await Promise.all(inFlight)
}
