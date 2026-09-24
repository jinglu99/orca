import React from 'react'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'

/**
 * Picks which of a group's repos the new workspace checks out.
 *
 * Why this is a control rather than always-all: one submit becomes one worktree per repo, so a
 * large group turns a single click into dozens of checkouts and gigabytes on disk. Most features
 * touch a handful of repos, and the group is the wrong granularity to force on them.
 */
export function GroupMemberRepoField({
  repos,
  selectedRepoIds,
  onSelectedRepoIdsChange
}: {
  repos: readonly Repo[]
  /** `null` means every repo in the group, including ones added later. */
  selectedRepoIds: ReadonlySet<string> | null
  onSelectedRepoIdsChange: (next: ReadonlySet<string> | null) => void
}): React.JSX.Element {
  const allIds = React.useMemo(() => new Set(repos.map((repo) => repo.id)), [repos])
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {translate('auto.components.NewWorkspaceComposerCard.groupMemberRepos', 'Repositories')}
      </label>
      <RepoMultiCombobox
        repos={repos}
        selected={selectedRepoIds ?? allIds}
        onChange={onSelectedRepoIdsChange}
        onSelectAll={() => onSelectedRepoIdsChange(null)}
      />
      <p className="text-[11px] leading-4 text-muted-foreground">
        {translate(
          'auto.components.NewWorkspaceComposerCard.groupMemberReposDetail',
          'Each selected repository gets its own worktree inside the workspace directory.'
        )}
      </p>
    </div>
  )
}
