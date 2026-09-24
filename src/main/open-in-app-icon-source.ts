/**
 * Which file to ask the OS for an icon of, given a launcher path.
 *
 * Why not just the launcher: a JetBrains Toolbox launcher is a bash script, and the OS icon for a
 * script is a generic script glyph, identical for GoLand and CLion. The script names the real
 * application bundle it opens, so that is what carries the product's icon.
 */

/** Longest `.app` bundle prefix of a macOS path, or null when the path is not inside one. */
export function getMacAppBundlePath(pathValue: string): string | null {
  const match = /^(.*?\.app)(?:\/|$)/.exec(pathValue)
  return match ? match[1] : null
}

/**
 * The application a JetBrains Toolbox shell launcher opens, read from its `open -na "<path>"` line.
 *
 * Deliberately narrow: only the exact shape Toolbox generates is accepted, because a looser parse
 * over an arbitrary shell script would start guessing at paths the user never meant to expose.
 */
export function getToolboxLauncherApplication(scriptContents: string): string | null {
  const match = /^\s*open\s+(?:-\S+\s+)*-?\w*a\s+"([^"]+)"/m.exec(scriptContents)
  if (match?.[1]) {
    return match[1]
  }
  return null
}

export type OpenInAppIconSourceDeps = {
  platform: NodeJS.Platform
  fileExists: (path: string) => boolean
  readTextFile: (path: string) => string
}

/**
 * The best path to render an icon for, falling back to the launcher itself.
 *
 * Never throws: an icon is decoration, so an unreadable launcher degrades to the generic glyph
 * rather than failing the menu that hosts it.
 */
export function resolveOpenInAppIconSource(
  launcherPath: string,
  deps: OpenInAppIconSourceDeps
): string {
  if (deps.platform !== 'darwin') {
    return launcherPath
  }
  const ownBundle = getMacAppBundlePath(launcherPath)
  if (ownBundle) {
    return ownBundle
  }
  let contents = ''
  try {
    contents = deps.readTextFile(launcherPath)
  } catch {
    return launcherPath
  }
  const target = getToolboxLauncherApplication(contents)
  if (!target) {
    return launcherPath
  }
  const bundle = getMacAppBundlePath(target)
  const candidate = bundle ?? target
  return deps.fileExists(candidate) ? candidate : launcherPath
}

/**
 * The `.icns` inside a macOS bundle that carries its product icon.
 *
 * Why read the file rather than ask the OS: `app.getFileIcon` on a bundle answers from Launch
 * Services, which returns the generic application placeholder for an app it has not registered —
 * exactly the case for a JetBrains IDE installed by Toolbox rather than dragged to /Applications.
 *
 * Why the name match: a JetBrains bundle ships several icons (`frontend.icns` alongside
 * `goland.icns`), and `CFBundleIconFile` is consistently the bundle's own name lowercased, so
 * matching case-insensitively picks the product icon without parsing a possibly binary plist.
 */
export function resolveMacAppIconFile(
  bundlePath: string,
  deps: { readDirectory: (path: string) => string[] }
): string | null {
  const bundleName = /([^/]+)\.app$/.exec(bundlePath)?.[1]
  if (!bundleName) {
    return null
  }
  const resources = `${bundlePath}/Contents/Resources`
  let entries: string[] = []
  try {
    entries = deps.readDirectory(resources)
  } catch {
    return null
  }
  const icns = entries.filter((entry) => entry.toLowerCase().endsWith('.icns'))
  const named = icns.find((entry) => entry.toLowerCase() === `${bundleName.toLowerCase()}.icns`)
  if (named) {
    return `${resources}/${named}`
  }
  // Why only when it is the sole candidate: with several icons and no name match, any pick is a
  // guess, and the generic fallback is more honest than the wrong product's mark.
  return icns.length === 1 ? `${resources}/${icns[0]}` : null
}
