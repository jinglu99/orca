import { translate } from '@/i18n/i18n'

export const SORT_OPTIONS = [
  {
    id: 'name',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.3728165cdd', 'Name')
    },
    description: null
  },
  {
    id: 'smart',
    get label() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.503462f2b4',
        'Agent Activity'
      )
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.b759bb87ee',
        'Agents that need attention, then most recent activity.'
      )
    }
  },
  {
    id: 'recent',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.b451c8b162', 'Recent')
    },
    description: null
  },
  {
    id: 'visited',
    get label() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.recentlyUsed',
        'Recently used'
      )
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.recentlyUsedDescription',
        'Workspaces you switched to most recently come first.'
      )
    }
  },
  {
    id: 'repo',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.2170d553cf', 'Project')
    },
    description: null
  },
  {
    id: 'manual',
    get label() {
      return translate('auto.components.sidebar.SidebarWorkspaceOptionsMenu.7b316bdd51', 'Manual')
    },
    get description() {
      return translate(
        'auto.components.sidebar.SidebarWorkspaceOptionsMenu.7153d07485',
        'Drag workspaces to arrange them within each group.'
      )
    }
  }
] as const
