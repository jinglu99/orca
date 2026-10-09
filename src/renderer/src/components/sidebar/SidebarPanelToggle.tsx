import React from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Button } from '@/components/ui/button'

/** Switches the sidebar between the per-project tree and a flat, most-recently-used workspace list. */
export function SidebarPanelToggle(): React.JSX.Element {
  // Subscribe to locale changes before using translate().
  useTranslation()
  const groupBy = useAppStore((s) => s.groupBy)
  const setGroupBy = useAppStore((s) => s.setGroupBy)
  const setSortBy = useAppStore((s) => s.setSortBy)
  // Why: status/PR groupings are workspace views too, matching the former title logic.
  const projectsActive = groupBy === 'repo'

  const showProjects = (): void => {
    if (groupBy !== 'repo') {
      setGroupBy('repo')
    }
  }
  const showWorkspaces = (): void => {
    if (groupBy !== 'none') {
      setGroupBy('none')
    }
    setSortBy('visited')
  }

  return (
    <div
      role="group"
      aria-label={translate('dashboard.sidebar.panel', 'Sidebar panel')}
      // Why min-w-0 + truncate: long localized labels (es "Espacios de trabajo") must not wrap out of the h-8 header.
      className="ml-1 flex min-w-0 items-center gap-0.5"
    >
      <Button
        type="button"
        variant={projectsActive ? 'secondary' : 'ghost'}
        size="xs"
        aria-pressed={projectsActive}
        data-sidebar-section-title="projects"
        onClick={showProjects}
        className="min-w-0 shrink"
      >
        <span className="truncate">{translate('dashboard.sidebar.projects', 'Projects')}</span>
      </Button>
      <Button
        type="button"
        variant={projectsActive ? 'ghost' : 'secondary'}
        size="xs"
        aria-pressed={!projectsActive}
        data-sidebar-section-title="workspaces"
        onClick={showWorkspaces}
        className="min-w-0 shrink"
      >
        <span className="truncate">{translate('dashboard.sidebar.workspaces', 'Workspaces')}</span>
      </Button>
    </div>
  )
}
