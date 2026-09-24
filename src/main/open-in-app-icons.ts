import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { app } from 'electron'
import { resolveExternalEditorLaunchSpec } from './external-editor-launch'
import { extractIcnsPngEntries, pickIcnsPngForDisplay } from './icns-png-extraction'
import {
  getMacAppBundlePath,
  resolveMacAppIconFile,
  resolveOpenInAppIconSource
} from './open-in-app-icon-source'

/**
 * Real application icons for the configured "Open in" commands, as data URLs.
 *
 * Why the OS rather than a bundled or remote image: the favicon service can only answer per
 * domain, so every JetBrains IDE resolves to the same company mark, and a bundled icon set would
 * go stale and cover only the products we thought of. The installed application already carries
 * its own icon, and that also covers an app the user configured that we have never heard of.
 */
export async function loadOpenInAppIcons(
  commands: readonly string[]
): Promise<Record<string, string>> {
  const icons: Record<string, string> = {}
  await Promise.all(
    [...new Set(commands.map((command) => command.trim()).filter(Boolean))].map(async (command) => {
      const dataUrl = await loadOpenInAppIcon(command)
      if (dataUrl) {
        icons[command] = dataUrl
      }
    })
  )
  return icons
}

async function loadOpenInAppIcon(command: string): Promise<string | null> {
  try {
    const launchSpec = resolveExternalEditorLaunchSpec(command, '/')
    // A compound shell command has no single executable to take an icon from.
    if (launchSpec.kind !== 'executable' || !existsSync(launchSpec.spawnCmd)) {
      return null
    }
    const source = resolveOpenInAppIconSource(launchSpec.spawnCmd, {
      platform: process.platform,
      fileExists: existsSync,
      readTextFile: (path) => readFileSync(path, 'utf8')
    })
    // Why the bundle's own icon file first: see resolveMacAppIconFile — Launch Services answers
    // with a placeholder for apps it has not registered.
    const bundlePath = process.platform === 'darwin' ? getMacAppBundlePath(source) : null
    const iconFile = bundlePath
      ? resolveMacAppIconFile(bundlePath, { readDirectory: (path) => readdirSync(path) })
      : null
    const bundlePng = iconFile ? readIcnsPng(iconFile) : null
    if (bundlePng) {
      return `data:image/png;base64,${bundlePng.toString('base64')}`
    }
    // Why 'normal' and never 'large': Electron 43 aborts the main process with SIGTRAP on the
    // large variant on macOS, taking the whole app down for the sake of an icon.
    const icon = await app.getFileIcon(source, { size: 'normal' })
    // Why the emptiness check: a path with no associated icon yields a blank image rather than an
    // error, and a blank square reads as a broken row.
    return icon.isEmpty() ? null : icon.toDataURL()
  } catch {
    // Icons are decoration; a failure here must never break the menu that hosts them.
    return null
  }
}

/** Why capped: an icns is read whole, and a pathological file should not be pulled into memory. */
const MAX_ICNS_BYTES = 20 * 1024 * 1024

function readIcnsPng(iconFile: string): Buffer | null {
  try {
    const contents = readFileSync(iconFile)
    if (contents.length > MAX_ICNS_BYTES) {
      return null
    }
    return pickIcnsPngForDisplay(extractIcnsPngEntries(contents))
  } catch {
    return null
  }
}
