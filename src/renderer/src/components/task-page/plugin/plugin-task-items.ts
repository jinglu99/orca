import type { PluginTaskItem } from '../../../../../shared/plugins/plugin-task-provider'

export function filterPluginTaskItems(items: PluginTaskItem[], query: string): PluginTaskItem[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return items
  }
  return items.filter((item) =>
    [item.key, item.id, item.title, item.project, item.status?.label, ...(item.labels ?? [])].some(
      (value) => value?.toLowerCase().includes(needle)
    )
  )
}

const WORKSPACE_NAME_MAX_LENGTH = 80

// Why: passed as a user-style prefilled name, so it becomes the display name verbatim and
// main's sanitizeWorktreeName derives the branch/folder, keeping CJK letters.
export function getPluginTaskWorkspaceName(item: PluginTaskItem): string {
  const name = (item.workspaceName ?? item.title).trim().slice(0, WORKSPACE_NAME_MAX_LENGTH).trim()
  return name || (item.key ?? item.id)
}
