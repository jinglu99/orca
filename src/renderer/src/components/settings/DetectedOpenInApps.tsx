import React from 'react'
import { Check } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut
} from '@/components/ui/dropdown-menu'
import { InstalledOpenInApplicationIcon } from '@/lib/open-in-app-catalog'
import { translate } from '@/i18n/i18n'
import type { DetectedOpenInApplication } from '../../../../shared/shell-open-types'
import type { OpenInApplication } from '../../../../shared/ui-chrome-types'

/**
 * Editors found on this machine, fetched once when the setting mounts.
 *
 * Why not on every render: detection stats a handful of directories in the main process, and the
 * set of installed IDEs does not change while a settings pane is open.
 */
export function useDetectedOpenInApplications(): DetectedOpenInApplication[] {
  const [detected, setDetected] = React.useState<DetectedOpenInApplication[]>([])
  React.useEffect(() => {
    let cancelled = false
    void window.api.shell
      .detectOpenInApplications()
      .then((apps) => {
        if (!cancelled) {
          setDetected(apps)
        }
      })
      // Why swallowed: the presets and the custom-app row still work, so a failed scan should
      // narrow the menu rather than break it.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return detected
}

/** Detected editors the user has not added yet, so the list shrinks as they are picked. */
export function getUnaddedDetectedApps(
  detected: readonly DetectedOpenInApplication[],
  applications: readonly Pick<OpenInApplication, 'command'>[]
): DetectedOpenInApplication[] {
  const added = new Set(applications.map((application) => application.command.trim().toLowerCase()))
  return detected.filter((app) => !added.has(app.command.trim().toLowerCase()))
}

export function DetectedOpenInAppItems({
  detected,
  disabled,
  onAdd
}: {
  detected: readonly DetectedOpenInApplication[]
  disabled: boolean
  onAdd: (app: DetectedOpenInApplication) => void
}): React.JSX.Element | null {
  if (detected.length === 0) {
    return null
  }
  return (
    <>
      <DropdownMenuLabel>
        {translate(
          'auto.components.settings.OpenInMenuSetting.detectedOnThisMachine',
          'Found on this machine'
        )}
      </DropdownMenuLabel>
      {detected.map((app) => (
        <DropdownMenuItem
          key={app.command}
          disabled={disabled}
          onSelect={() => onAdd(app)}
          className="gap-2"
        >
          <InstalledOpenInApplicationIcon application={app} size={14} />
          <span className="min-w-0 truncate">{app.label}</span>
          <DropdownMenuShortcut className="inline-flex items-center gap-1">
            <Check className="size-3" />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  )
}
