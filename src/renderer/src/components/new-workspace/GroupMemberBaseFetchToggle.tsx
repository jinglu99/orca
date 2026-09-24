import React from 'react'
import { SettingsSwitch } from '@/components/settings/SettingsFormControls'
import { translate } from '@/i18n/i18n'

/**
 * Lets a group create trade base freshness for speed.
 *
 * Why it earns a control instead of a fixed policy: a group workspace checks out one worktree per
 * member repo, and with base-ref refresh on that is a fetch per repo through the host's narrow
 * network budget — seconds for three repos, minutes for fifty. Which side of that trade is right
 * depends on the group, so the default stays correct (fetch first) and the user opts into fast.
 */
export function GroupMemberBaseFetchToggle({
  repoCount,
  skipBaseFetch,
  onSkipBaseFetchChange,
  disabled
}: {
  repoCount: number
  skipBaseFetch: boolean
  onSkipBaseFetchChange: (next: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  const label = translate(
    'auto.components.NewWorkspaceComposerCard.groupSkipBaseFetch',
    'Skip pulling the latest base ref'
  )
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <span className="text-[13px] leading-5 text-foreground">
        {label}
        <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
          {translate(
            'auto.components.NewWorkspaceComposerCard.groupSkipBaseFetchDetail',
            'Branches all {{value0}} repositories from the base ref already on disk. Much faster, but a repository that has not been fetched recently starts from older code.',
            { value0: String(repoCount) }
          )}
        </span>
      </span>
      <SettingsSwitch
        checked={skipBaseFetch}
        disabled={disabled}
        onChange={() => onSkipBaseFetchChange(!skipBaseFetch)}
        ariaLabel={label}
      />
    </div>
  )
}
