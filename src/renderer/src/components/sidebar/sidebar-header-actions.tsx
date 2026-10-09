import React, { useCallback, useMemo } from 'react'
import { ChevronsDownUp, ChevronsUpDown, FolderPlus, Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { useProjectHostSetupProjection } from '@/store/selectors'
import {
  applySidebarProjectCollapse,
  areAllSidebarProjectsCollapsed,
  getSidebarProjectCollapseKeys
} from './sidebar-project-collapse-keys'
import { EMPTY_PROJECT_GROUPS } from './worktree-list/viewport/viewport-props'
import { getFolderMembersExpandedKeys } from './worktree-list/grouping/flat-workspace-nesting'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatOptionalPrimaryShortcutLabel } from '@/hooks/useShortcutLabel'
import { translate } from '@/i18n/i18n'
import { openWorkspaceCreationComposerWithTourHandoff } from '../contextual-tours/workspace-creation-tour-handoff'
import SidebarWorkspaceOptionsMenu from './SidebarWorkspaceOptionsMenu'

function AddProjectButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  const label = translate('auto.components.sidebar.SidebarHeader.addProject', 'Add project')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          onClick={() => openModal('add-repo')}
        >
          <FolderPlus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NewWorkspaceButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element {
  const keybindings = useAppStore((s) => s.keybindings)
  // Why primary: workspace.create binds both Mod+N and Mod+Shift+N, and listing
  // every alias in a one-line tooltip reads as noise rather than help.
  const shortcutLabel = formatOptionalPrimaryShortcutLabel('workspace.create', keybindings)
  const label = translate('auto.components.sidebar.SidebarHeader.92154beb7e', 'New workspace')

  // Why the tour handoff here: the tour highlights this button, and it is now
  // the control that performs the action rather than one that opens a menu.
  const handleCreateWorkspace = useCallback(() => {
    openWorkspaceCreationComposerWithTourHandoff()
  }, [])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          data-contextual-tour-target="workspace-create-control"
          onClick={handleCreateWorkspace}
        >
          <Plus className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
        {shortcutLabel ? <span className="ml-1.5 text-background/60">{shortcutLabel}</span> : null}
      </TooltipContent>
    </Tooltip>
  )
}

function CollapseProjectsButton({
  preserveWorkspaceBoardOpen
}: {
  preserveWorkspaceBoardOpen: boolean
}): React.JSX.Element | null {
  const repos = useAppStore((s) => s.repos)
  const projectGroups = useAppStore((s) => s.projectGroups ?? EMPTY_PROJECT_GROUPS)
  const collapsedGroups = useAppStore((s) => s.collapsedGroups)
  const setCollapsedGroups = useAppStore((s) => s.setCollapsedGroups)
  const groupBy = useAppStore((s) => s.groupBy)
  const workspaceLineageByChildKey = useAppStore((s) => s.workspaceLineageByChildKey)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const projectHostSetupProjection = useProjectHostSetupProjection()
  const projectKeys = useMemo(
    () =>
      getSidebarProjectCollapseKeys({
        repos,
        projectGroups,
        projectGrouping: {
          projects: projectHostSetupProjection.projects,
          projectHostSetups: projectHostSetupProjection.setups
        }
      }),
    [projectGroups, projectHostSetupProjection, repos]
  )
  // Why: the flat Workspaces panel has no project headers; there the sweep folds group members.
  const folderKeys = useMemo(
    () =>
      groupBy === 'none'
        ? getFolderMembersExpandedKeys(workspaceLineageByChildKey, folderWorkspaces ?? [])
        : null,
    [folderWorkspaces, groupBy, workspaceLineageByChildKey]
  )
  const allCollapsed = folderKeys
    ? folderKeys.every((key) => !collapsedGroups.has(key))
    : areAllSidebarProjectsCollapsed(projectKeys, collapsedGroups)
  const label = folderKeys
    ? allCollapsed
      ? translate(
          'auto.components.sidebar.SidebarHeader.expandAllChildWorkspaces',
          'Expand all child workspaces'
        )
      : translate(
          'auto.components.sidebar.SidebarHeader.collapseAllChildWorkspaces',
          'Collapse all child workspaces'
        )
    : allCollapsed
      ? translate('auto.components.sidebar.SidebarHeader.expandAllProjects', 'Expand all projects')
      : translate(
          'auto.components.sidebar.SidebarHeader.collapseAllProjects',
          'Collapse all projects'
        )
  const handleClick = useCallback(() => {
    if (folderKeys) {
      // Folder keys mark expansion, so expanding adds them.
      setCollapsedGroups(applySidebarProjectCollapse(folderKeys, collapsedGroups, allCollapsed))
      return
    }
    setCollapsedGroups(applySidebarProjectCollapse(projectKeys, collapsedGroups, !allCollapsed))
  }, [allCollapsed, collapsedGroups, folderKeys, projectKeys, setCollapsedGroups])

  // Why hidden with nothing to sweep: a control that cannot change anything reads as broken.
  if ((folderKeys ?? projectKeys).length === 0) {
    return null
  }
  const Icon = allCollapsed ? ChevronsUpDown : ChevronsDownUp
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className="text-muted-foreground"
          aria-label={label}
          data-workspace-board-preserve-open={preserveWorkspaceBoardOpen ? '' : undefined}
          onClick={handleClick}
        >
          <Icon className="size-3.5" strokeWidth={2.25} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function SidebarHeaderActions({
  onWorkspaceBoardMenuOpenChange,
  agentsViewActive = false
}: {
  onWorkspaceBoardMenuOpenChange: (open: boolean) => void
  agentsViewActive?: boolean
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1" data-sidebar-header-actions="">
      {/* Why only options swap: the activity view portals its own options button into this slot
          (SidebarHeader), and keeping Add project means no header button shifts between views. */}
      {agentsViewActive ? null : (
        <>
          <SidebarWorkspaceOptionsMenu
            preserveWorkspaceBoardOpen
            onMenuOpenChange={onWorkspaceBoardMenuOpenChange}
          />
          <CollapseProjectsButton preserveWorkspaceBoardOpen />
        </>
      )}
      <AddProjectButton preserveWorkspaceBoardOpen />
      <NewWorkspaceButton preserveWorkspaceBoardOpen />
    </div>
  )
}
