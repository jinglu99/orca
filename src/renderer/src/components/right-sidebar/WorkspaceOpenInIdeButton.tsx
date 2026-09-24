import React from 'react'
import { FolderTree, SquareArrowOutUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  WorktreeOpenInMenuItems,
  WorktreeOpenInSubMenu
} from '@/components/sidebar/WorktreeOpenInMenu'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getAttachedWorktreesForFolderWorkspace } from './folder-workspace-attached-worktrees'
import { buildWorkspaceOpenInTargets } from './workspace-open-in-targets'

/**
 * Opens this workspace in an external IDE, and for a group workspace lets the user pick which
 * member repository to open instead of the container.
 *
 * Why a target picker rather than only the root: a group workspace's container holds one checkout
 * per repo, and an IDE opened on the container indexes all of them. Most JetBrains work is one
 * repo at a time, and the member checkouts are otherwise only reachable by hunting down their own
 * sidebar rows and using the context menu there.
 */
export function WorkspaceOpenInIdeButton({
  worktreePath,
  connectionId
}: {
  worktreePath: string
  connectionId?: string | null
}): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorkspaceKey = useAppStore((s) => s.activeWorkspaceKey)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const workspaceLineageByChildKey = useAppStore((s) => s.workspaceLineageByChildKey)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const repos = useAppStore((s) => s.repos)

  const { folderWorkspace, childWorktrees } = getAttachedWorktreesForFolderWorkspace({
    activeWorkspaceKey,
    activeWorktreeId,
    folderWorkspaces,
    workspaceLineageByChildKey,
    worktreeLineageById,
    worktreesByRepo
  })
  const label = translate(
    'auto.components.right.sidebar.FileExplorerToolbar.openInIde',
    'Open in external app'
  )
  const targets = buildWorkspaceOpenInTargets({
    worktreePath,
    rootLabel: translate(
      'auto.components.right.sidebar.FileExplorerToolbar.openInIdeRoot',
      'Workspace root'
    ),
    memberWorktrees: folderWorkspace ? childWorktrees : [],
    repos
  })
  const hasMembers = targets.length > 1

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
              aria-label={label}
            >
              <SquareArrowOutUpRight className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        {hasMembers ? (
          <>
            {targets
              .filter((target) => target.isRoot)
              .map((target) => (
                <WorktreeOpenInSubMenu
                  key={target.id}
                  worktreePath={target.path}
                  connectionId={connectionId}
                  label={target.label}
                  icon={<FolderTree className="size-3.5" />}
                />
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {translate(
                'auto.components.right.sidebar.FileExplorerToolbar.openInIdeRepositories',
                'Repositories'
              )}
            </DropdownMenuLabel>
            {targets
              .filter((target) => !target.isRoot)
              .map((target) => (
                <WorktreeOpenInSubMenu
                  key={target.id}
                  worktreePath={target.path}
                  connectionId={connectionId}
                  label={target.label}
                />
              ))}
          </>
        ) : (
          <WorktreeOpenInMenuItems
            worktreePath={worktreePath}
            connectionId={connectionId}
            labelPrefix="Open in "
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
