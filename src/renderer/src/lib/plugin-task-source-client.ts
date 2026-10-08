import {
  pluginTaskDetailResultSchema,
  pluginTaskListResultSchema,
  type PluginTaskDetailArgs,
  type PluginTaskDetailResult,
  type PluginTaskListArgs,
  type PluginTaskListResult
} from '../../../shared/plugins/plugin-task-provider'
import type { ActivePluginTaskSource } from '@/store/plugin-task-sources'

async function invokePluginTaskCommand(
  source: ActivePluginTaskSource,
  commandId: string,
  args: PluginTaskListArgs | PluginTaskDetailArgs
): Promise<unknown> {
  const pluginsApi = window.api?.plugins
  if (!pluginsApi) {
    throw new Error('Plugins are not available in this client.')
  }
  return pluginsApi.invokeCommand({ pluginKey: source.pluginKey, commandId, args })
}

function describeInvalidResult(pluginName: string, issue: string | undefined): Error {
  return new Error(`${pluginName} returned an invalid result${issue ? `: ${issue}` : ''}`)
}

export async function listPluginTasks(
  source: ActivePluginTaskSource,
  view: string | null
): Promise<PluginTaskListResult> {
  const raw = await invokePluginTaskCommand(source, source.listCommand, {
    providerId: source.id,
    view
  })
  const parsed = pluginTaskListResultSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw describeInvalidResult(
      source.pluginName,
      issue ? `${issue.path.join('.')} ${issue.message}` : undefined
    )
  }
  return parsed.data
}

export async function getPluginTaskDetail(
  source: ActivePluginTaskSource,
  itemId: string
): Promise<PluginTaskDetailResult | null> {
  if (!source.detailCommand) {
    return null
  }
  const raw = await invokePluginTaskCommand(source, source.detailCommand, {
    providerId: source.id,
    itemId
  })
  const parsed = pluginTaskDetailResultSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw describeInvalidResult(
      source.pluginName,
      issue ? `${issue.path.join('.')} ${issue.message}` : undefined
    )
  }
  return parsed.data
}

/** Electron wraps main-side rejections as "Error invoking remote method …: Error: <msg>". */
export function formatPluginTaskError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const unwrapped = message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
  // Worker errors carry a stack; the first line is the message.
  return unwrapped.split('\n')[0]?.trim() || message
}
