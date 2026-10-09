import { runProcess } from '../../shared/child-process/run-process'
import { readOrcaCliVersion } from '../cli-version'
import type { CommandHandler } from '../dispatch'
import { serveOrcaMcpOverStdio, type RunOrcaCommand } from '../mcp/orca-mcp-server'

/** Longest tool call (wait_for_agent caps at 600s) plus room for the CLI to start and report. */
const TOOL_COMMAND_TIMEOUT_MS = 660_000

// Why: re-run this very CLI build (same runtime, entry script and env) rather than resolving an
// `orca` on PATH, which can be another install talking to another Orca instance.
const runThisCli: RunOrcaCommand = async (argv) => {
  const entry = process.argv[1]
  if (!entry) {
    throw new Error('Cannot locate the running Orca CLI entry script')
  }
  const result = await runProcess({
    program: process.execPath,
    args: [...process.execArgv, entry, ...argv],
    env: process.env,
    timeoutMs: TOOL_COMMAND_TIMEOUT_MS
  })
  return result.timedOut
    ? { code: null, stdout: result.stdout, stderr: `${result.stderr}\nTimed out`.trim() }
    : result
}

export const MCP_HANDLERS: Record<string, CommandHandler> = {
  'mcp serve': async () => {
    await serveOrcaMcpOverStdio({
      runCommand: runThisCli,
      version: readOrcaCliVersion() ?? '0.0.0'
    })
  }
}
