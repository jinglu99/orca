import type React from 'react'
import { AppWindow } from 'lucide-react'
import type { OpenInApplication } from '../../../shared/ui-chrome-types'
import { cn } from './utils'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { useOpenInAppIcon } from './open-in-app-icons'

export type OpenInAppPreset = {
  id: string
  label: string
  command: string
  faviconDomain: string
  iconClassName?: string
}

export const getOpenInAppPresets = createLocalizedCatalog(() => [
  {
    id: 'vscode',
    label: translate('auto.lib.open.in.app.catalog.173553f73a', 'VS Code'),
    command: 'code',
    faviconDomain: 'code.visualstudio.com'
  },
  {
    id: 'cursor',
    label: translate('auto.lib.open.in.app.catalog.d62b12e98a', 'Cursor'),
    command: 'cursor',
    faviconDomain: 'cursor.com'
  },
  {
    id: 'zed',
    label: translate('auto.lib.open.in.app.catalog.f8b8ca2711', 'Zed'),
    command: 'zed',
    faviconDomain: 'zed.dev',
    // Why: Zed's favicon is a black transparent mark, which disappears on dark menus.
    iconClassName: 'dark:invert'
  }
])

export function getOpenInAppPreset(
  application: Pick<OpenInApplication, 'command'>
): OpenInAppPreset | null {
  const command = application.command.trim().toLowerCase()
  return getOpenInAppPresets().find((preset) => preset.command === command) ?? null
}

export function isOpenInAppPresetAdded(
  applications: readonly Pick<OpenInApplication, 'command'>[],
  preset: OpenInAppPreset
): boolean {
  return applications.some(
    (application) => application.command.trim().toLowerCase() === preset.command
  )
}

/**
 * Renders an app icon from what the caller already knows.
 *
 * Deliberately hookless: it is called directly in tests and in list-building code, so fetching
 * belongs in the wrapper below rather than here.
 */
export function OpenInApplicationIcon({
  application,
  size = 14,
  installedIcon
}: {
  application: Pick<OpenInApplication, 'command'>
  size?: number
  /** The installed application's own icon, when one has been resolved. */
  installedIcon?: string | null
}): React.JSX.Element {
  // Why the installed icon wins: the favicon service answers per domain, so every JetBrains IDE
  // resolves to the same company mark, and it needs the network to say anything at all.
  if (installedIcon) {
    return (
      <img
        src={installedIcon}
        width={size}
        height={size}
        alt=""
        aria-hidden
        className="shrink-0"
        style={{ borderRadius: 2 }}
      />
    )
  }
  const preset = getOpenInAppPreset(application)
  if (preset) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${preset.faviconDomain}&sz=64`}
        width={size}
        height={size}
        alt=""
        aria-hidden
        className={cn('shrink-0', preset.iconClassName)}
        style={{ borderRadius: 2 }}
      />
    )
  }
  return <AppWindow width={size} height={size} />
}

/** The icon for an app, resolving the installed application's real icon on this machine. */
export function InstalledOpenInApplicationIcon({
  application,
  size = 14
}: {
  application: Pick<OpenInApplication, 'command'>
  size?: number
}): React.JSX.Element {
  return (
    <OpenInApplicationIcon
      application={application}
      size={size}
      installedIcon={useOpenInAppIcon(application.command)}
    />
  )
}
