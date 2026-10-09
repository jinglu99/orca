import { withCodexTerminalServerIsolationEnv } from '../../shared/codex-terminal-server-isolation'
import type { GlobalSettings } from '../../shared/global-settings-types'
import { normalizeTerminalEnvironmentVariables } from '../../shared/terminal-environment-variables'
import { addWslEnvKeys } from '../../shared/wsl-env'

type TerminalEnvironmentSettings =
  | Partial<
      Pick<
        GlobalSettings,
        'terminalEnvironmentVariables' | 'codexTerminalServerIsolation' | 'codexSharedServerWarning'
      >
    >
  | null
  | undefined

/** The settings-driven part of every new terminal's env; every provider spawns from the result. */
export function withTerminalSettingsEnv(
  env: Record<string, string> | undefined,
  settings: TerminalEnvironmentSettings,
  connectionId: string | null | undefined
): Record<string, string> | undefined {
  return withCodexTerminalServerIsolationEnv(
    withTerminalEnvironmentVariables(env, settings, connectionId),
    settings
  )
}

/**
 * Layers the user's terminal environment under the launch env, so a pane's own launch values and
 * Orca's identity keys still win. SSH panes are skipped: these values describe this computer.
 */
export function withTerminalEnvironmentVariables(
  env: Record<string, string> | undefined,
  settings: TerminalEnvironmentSettings,
  connectionId: string | null | undefined,
  platform: NodeJS.Platform = process.platform
): Record<string, string> | undefined {
  if (connectionId) {
    return env
  }
  const userEnv = normalizeTerminalEnvironmentVariables(settings?.terminalEnvironmentVariables)
  const names = Object.keys(userEnv)
  if (names.length === 0) {
    return env
  }
  const merged = { ...userEnv, ...env }
  if (platform === 'win32') {
    // Why: wsl.exe imports only the Windows variables WSLENV names.
    addWslEnvKeys(merged, names)
  }
  return merged
}
