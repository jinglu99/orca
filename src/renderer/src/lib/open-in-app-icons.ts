import { useSyncExternalStore } from 'react'

/**
 * Real application icons, fetched once per command and shared by every menu that shows one.
 *
 * Why a module-level cache rather than per-component state: the same few commands render in the
 * workspace menu, the file-explorer button and the settings list, and each icon costs a main
 * process call into the OS icon services. One fetch per command per session is plenty — the
 * installed applications do not change while the window is open.
 */
const iconsByCommand = new Map<string, string | null>()
const inFlight = new Set<string>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function requestIcon(command: string): void {
  if (iconsByCommand.has(command) || inFlight.has(command)) {
    return
  }
  inFlight.add(command)
  void window.api.shell
    .getOpenInAppIcons([command])
    .then((icons) => {
      // Why null is cached too: an app with no icon must not be re-requested on every render.
      iconsByCommand.set(command, icons[command] ?? null)
    })
    .catch(() => {
      iconsByCommand.set(command, null)
    })
    .finally(() => {
      inFlight.delete(command)
      emit()
    })
}

/** The installed application's icon for `command`, or null until one is known to exist. */
export function useOpenInAppIcon(command: string): string | null {
  const trimmed = command.trim()
  const icon = useSyncExternalStore(
    subscribe,
    () => (trimmed ? (iconsByCommand.get(trimmed) ?? null) : null),
    () => null
  )
  if (trimmed) {
    requestIcon(trimmed)
  }
  return icon
}

export function __resetOpenInAppIconCacheForTests(): void {
  iconsByCommand.clear()
  inFlight.clear()
}
