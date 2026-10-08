// Runs `bytedcli ... --json` and unwraps its envelope. Kept below the host's
// 30s command timeout so a slow call surfaces as a readable error.
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const TIMEOUT_MS = 25_000
const MAX_BUFFER_BYTES = 32 * 1024 * 1024
// Why: on Windows the npm shim is a .cmd that needs a shell; restricting args
// to this charset keeps that shell from ever seeing metacharacters. Free text
// (MQL) goes through a params file instead; see runBytedcliWithParams.
const SAFE_ARG = /^[\w.,:=@/\\-]+$/

function candidateCommands() {
  if (process.platform === 'win32') {
    return ['bytedcli.cmd', 'bytedcli.exe']
  }
  // The plugin worker inherits Orca's PATH, which may miss ~/.local/bin.
  return ['bytedcli', join(homedir(), '.local', 'bin', 'bytedcli')]
}

function execOnce(command, args) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
        windowsHide: true,
        shell: process.platform === 'win32' && command.endsWith('.cmd')
      },
      (error, stdout, stderr) => {
        if (error && error.code === 'ENOENT') {
          reject(error)
          return
        }
        if (error && error.killed) {
          reject(new Error(`bytedcli timed out after ${TIMEOUT_MS / 1000}s`))
          return
        }
        // bytedcli exits non-zero on API errors but still prints its envelope.
        resolve({ stdout: String(stdout), stderr: String(stderr), error })
      }
    )
  })
}

function parseEnvelope(stdout) {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index])
      if (parsed && typeof parsed === 'object' && 'status' in parsed) {
        return parsed
      }
    } catch {
      // Not the envelope line (progress output); keep scanning upward.
    }
  }
  return null
}

export async function runBytedcli(args) {
  for (const arg of args) {
    if (!SAFE_ARG.test(arg)) {
      throw new Error(`refusing unsafe bytedcli argument: ${arg}`)
    }
  }
  const fullArgs = [...args, '--json']
  let result = null
  for (const command of candidateCommands()) {
    try {
      result = await execOnce(command, fullArgs)
      break
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue
      }
      throw error
    }
  }
  if (!result) {
    throw new Error('bytedcli was not found. Install it, then run `bytedcli meego login`.')
  }
  const envelope = parseEnvelope(result.stdout)
  if (!envelope) {
    const detail = (result.stderr || result.stdout).trim().split('\n').slice(-3).join(' ')
    throw new Error(`bytedcli returned no JSON result${detail ? `: ${detail}` : ''}`)
  }
  if (envelope.status !== 'success') {
    const message = envelope.error?.message ?? 'bytedcli request failed'
    const hint = envelope.error?.hint
    throw new Error(hint ? `${message} (${hint})` : message)
  }
  return envelope.data
}

/** Meego MCP-backed commands wrap their payload as an MCP tool result. */
export function unwrapMcpResult(data) {
  const result = data?.result
  if (!result) {
    return data
  }
  if (result.isError) {
    const text = result.content?.find((part) => part.type === 'text')?.text
    throw new Error(text || 'Meego request failed')
  }
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent
  }
  const text = result.content?.find((part) => part.type === 'text')?.text
  return text ? JSON.parse(text) : null
}

/** For free-text inputs (MQL): passed as a `-P @file` JSON params file, never argv. */
export async function runBytedcliWithParams(args, params) {
  const dir = await mkdtemp(join(tmpdir(), 'orca-meego-'))
  const paramsPath = join(dir, 'params.json')
  try {
    await writeFile(paramsPath, JSON.stringify(params), 'utf8')
    return await runBytedcli([...args, '-P', `@${paramsPath}`])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
