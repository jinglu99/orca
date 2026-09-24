import { posix, win32 } from 'node:path'

/**
 * Where JetBrains Toolbox writes the shell launchers it generates (`goland`, `idea`, `rider`, …).
 *
 * Why this needs its own lookup: Toolbox only offers to add this directory to the shell PATH, and
 * a GUI app inherits the login environment rather than the shell's, so a launcher that works in a
 * terminal is invisible to a spawn from Electron. The command then resolves to its bare name and
 * fails with ENOENT, which reads as "editor misconfigured" when it is in fact installed.
 */
export function getJetBrainsToolboxScriptDirectories(
  platform: NodeJS.Platform,
  homePath: string,
  localAppData?: string | null
): string[] {
  if (platform === 'win32') {
    const base = localAppData?.trim()
    return base ? [win32.join(base, 'JetBrains', 'Toolbox', 'scripts')] : []
  }
  if (platform === 'darwin') {
    return [
      posix.join(homePath, 'Library', 'Application Support', 'JetBrains', 'Toolbox', 'scripts')
    ]
  }
  return [posix.join(homePath, '.local', 'share', 'JetBrains', 'Toolbox', 'scripts')]
}

/**
 * The Toolbox launcher for `commandName`, or null when Toolbox did not generate one.
 *
 * Deliberately name-for-name rather than fuzzy: the caller already has the user's configured
 * command, and guessing a different IDE from a near-miss would silently open the wrong product.
 */
export function resolveJetBrainsToolboxScript(
  commandName: string,
  options: {
    platform: NodeJS.Platform
    homePath: string
    localAppData?: string | null
    fileExists: (path: string) => boolean
  }
): string | null {
  const trimmed = commandName.trim()
  // Why rejected rather than joined: a value with separators is already a path, and the caller
  // resolves those directly — joining it under the scripts directory would invent a location.
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    return null
  }
  const pathOps = options.platform === 'win32' ? win32 : posix
  const candidateNames =
    options.platform === 'win32' ? [`${trimmed}.cmd`, `${trimmed}.bat`, trimmed] : [trimmed]
  for (const directory of getJetBrainsToolboxScriptDirectories(
    options.platform,
    options.homePath,
    options.localAppData
  )) {
    for (const name of candidateNames) {
      const candidate = pathOps.join(directory, name)
      if (options.fileExists(candidate)) {
        return candidate
      }
    }
  }
  return null
}
