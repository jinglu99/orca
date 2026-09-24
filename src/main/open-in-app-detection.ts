import { posix, win32 } from 'node:path'
import { getJetBrainsToolboxScriptDirectories } from './jetbrains-toolbox-scripts'
import { getMacAppBundlePath, getToolboxLauncherApplication } from './open-in-app-icon-source'

export type DetectedOpenInApp = {
  /** The launcher name, which is also what the user stores as the command. */
  command: string
  label: string
  /** Where the evidence came from, so the UI can explain an unfamiliar entry. */
  source: 'path' | 'jetbrains-toolbox'
}

/** Product names for the launchers JetBrains Toolbox generates. Brand names stay untranslated. */
const JETBRAINS_LAUNCHER_LABELS: Readonly<Record<string, string>> = {
  idea: 'IntelliJ IDEA',
  goland: 'GoLand',
  webstorm: 'WebStorm',
  pycharm: 'PyCharm',
  phpstorm: 'PhpStorm',
  rider: 'Rider',
  clion: 'CLion',
  rubymine: 'RubyMine',
  datagrip: 'DataGrip',
  rustrover: 'RustRover',
  studio: 'Android Studio',
  fleet: 'Fleet',
  gateway: 'JetBrains Gateway',
  dataspell: 'DataSpell',
  aqua: 'Aqua',
  writerside: 'Writerside'
}

/** GUI editors worth probing on PATH. Terminal editors are excluded: opening one detached from a
 *  terminal shows the user nothing. */
const PATH_EDITOR_LABELS: Readonly<Record<string, string>> = {
  code: 'VS Code',
  'code-insiders': 'VS Code Insiders',
  codium: 'VSCodium',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  zed: 'Zed',
  subl: 'Sublime Text',
  trae: 'Trae'
}

export type OpenInAppDetectionDeps = {
  platform: NodeJS.Platform
  homePath: string
  localAppData?: string | null
  pathEnv: string | null
  fileExists: (path: string) => boolean
  /** Entry names in a directory. May throw or return an empty list when it cannot be read. */
  readDirectory: (path: string) => string[]
  /** Reads a launcher script. May throw when it cannot be read. */
  readTextFile?: (path: string) => string
}

/**
 * IDEs this machine can actually launch, found by evidence on disk rather than by guessing.
 *
 * Two sources, because they fail in different ways: a JetBrains Toolbox launcher exists in a
 * directory that is usually absent from a GUI app's PATH, while VS Code-family editors install a
 * CLI shim onto PATH and never appear under Toolbox. Neither source alone covers a normal machine.
 */
export function detectOpenInApplications(deps: OpenInAppDetectionDeps): DetectedOpenInApp[] {
  const detected: DetectedOpenInApp[] = []
  const seen = new Set<string>()
  const add = (app: DetectedOpenInApp): void => {
    const key = app.command.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      detected.push(app)
    }
  }

  for (const directory of getJetBrainsToolboxScriptDirectories(
    deps.platform,
    deps.homePath,
    deps.localAppData
  )) {
    // Why guarded: an unreadable Toolbox directory (permissions, a broken symlink) must not take
    // the PATH-based editors down with it.
    let entries: string[] = []
    try {
      entries = deps.readDirectory(directory)
    } catch {
      entries = []
    }
    for (const entry of entries) {
      // Why the extension is dropped: Toolbox writes `goland` on POSIX and `goland.cmd` on
      // Windows, and the stored command should be the same name on both.
      const command = entry.replace(/\.(?:cmd|bat|exe)$/i, '')
      if (!command) {
        continue
      }
      // Why the target is verified: Toolbox leaves the launcher behind when an IDE is uninstalled,
      // so the script's existence alone would offer products the user no longer has.
      if (!toolboxLauncherTargetExists(pathOpsFor(deps.platform).join(directory, entry), deps)) {
        continue
      }
      add({
        command,
        // An unmapped launcher is still real evidence, so it is offered under its own name rather
        // than dropped for not being on a list.
        label: JETBRAINS_LAUNCHER_LABELS[command.toLowerCase()] ?? command,
        source: 'jetbrains-toolbox'
      })
    }
  }

  const pathOps = pathOpsFor(deps.platform)
  const directories = splitPathEnv(deps.pathEnv, deps.platform)
  for (const [command, label] of Object.entries(PATH_EDITOR_LABELS)) {
    const names = deps.platform === 'win32' ? [`${command}.cmd`, `${command}.exe`] : [command]
    const found = directories.some((directory) =>
      names.some((name) => deps.fileExists(pathOps.join(directory, name)))
    )
    if (found) {
      add({ command, label, source: 'path' })
    }
  }
  return detected
}

function splitPathEnv(pathEnv: string | null, platform: NodeJS.Platform): string[] {
  if (!pathEnv) {
    return []
  }
  return pathEnv
    .split(platform === 'win32' ? ';' : ':')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function pathOpsFor(platform: NodeJS.Platform): typeof posix {
  return platform === 'win32' ? win32 : posix
}

/**
 * Whether a Toolbox launcher still points at an application that is present.
 *
 * Only decidable on macOS, where the launcher names the bundle it opens. Elsewhere the script's
 * own existence is the best evidence available, so it is accepted.
 */
function toolboxLauncherTargetExists(launcherPath: string, deps: OpenInAppDetectionDeps): boolean {
  if (deps.platform !== 'darwin' || !deps.readTextFile) {
    return true
  }
  let contents = ''
  try {
    contents = deps.readTextFile(launcherPath)
  } catch {
    return true
  }
  const target = getToolboxLauncherApplication(contents)
  if (!target) {
    return true
  }
  return deps.fileExists(getMacAppBundlePath(target) ?? target)
}
