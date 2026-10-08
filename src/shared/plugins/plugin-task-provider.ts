import { z } from 'zod'
import { pluginCommandIdSchema, pluginIdSchema } from './plugin-manifest-fields'

/**
 * Plugin task providers (EXPERIMENTAL). A plugin contributes a task source to
 * the Tasks page by naming worker commands that list items and read one item.
 * The host never trusts command results: every payload is re-validated against
 * the schemas below before it reaches UI.
 */

export const PLUGIN_TASK_PROVIDER_LIMIT = 8
export const PLUGIN_TASK_PROVIDER_VIEW_LIMIT = 16
export const PLUGIN_TASK_LIST_ITEM_LIMIT = 500
export const PLUGIN_TASK_DETAIL_FIELD_LIMIT = 64

const pluginTaskViewContributionSchema = z
  .object({
    id: pluginIdSchema,
    title: z.string().min(1).max(64)
  })
  .strict()

export const pluginTaskProviderContributionSchema = z
  .object({
    id: pluginIdSchema,
    title: z.string().min(1).max(64),
    /** Lucide icon name shown in the Tasks source bar. */
    icon: z.string().min(1).max(64).optional(),
    /** Worker command returning `PluginTaskListResult` for `PluginTaskListArgs`. */
    listCommand: pluginCommandIdSchema,
    /** Worker command returning `PluginTaskDetailResult` for `PluginTaskDetailArgs`. */
    detailCommand: pluginCommandIdSchema.optional(),
    views: z
      .array(pluginTaskViewContributionSchema)
      .max(PLUGIN_TASK_PROVIDER_VIEW_LIMIT)
      .default([])
  })
  .strict()

export type PluginTaskProviderContribution = z.infer<typeof pluginTaskProviderContributionSchema>

export type PluginTaskListArgs = {
  providerId: string
  view: string | null
}

export type PluginTaskDetailArgs = {
  providerId: string
  itemId: string
}

const shortText = z.string().max(256)
const httpUrl = z
  .string()
  .max(4096)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return protocol === 'https:' || protocol === 'http:'
    } catch {
      return false
    }
  }, 'must be an http(s) URL')

export const PLUGIN_TASK_STATUS_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type PluginTaskStatusTone = (typeof PLUGIN_TASK_STATUS_TONES)[number]

export const pluginTaskItemSchema = z.object({
  id: z.string().min(1).max(256),
  /** Short human identifier such as `#123`; falls back to `id`. */
  key: shortText.optional(),
  title: z.string().min(1).max(1024),
  url: httpUrl.optional(),
  status: z
    .object({ label: shortText.min(1), tone: z.enum(PLUGIN_TASK_STATUS_TONES).optional() })
    .optional(),
  project: shortText.optional(),
  labels: z.array(shortText.min(1)).max(16).optional(),
  assignees: z.array(shortText.min(1)).max(16).optional(),
  updatedAt: shortText.optional(),
  /** Suggested workspace name; defaults to `title`. */
  workspaceName: shortText.min(1).optional()
})

export type PluginTaskItem = z.infer<typeof pluginTaskItemSchema>

export const pluginTaskListResultSchema = z.object({
  items: z.array(pluginTaskItemSchema).max(PLUGIN_TASK_LIST_ITEM_LIMIT)
})

export type PluginTaskListResult = z.infer<typeof pluginTaskListResultSchema>

export const pluginTaskDetailResultSchema = z.object({
  item: pluginTaskItemSchema,
  /** Plain text; rendered without markup. */
  description: z
    .string()
    .max(64 * 1024)
    .optional(),
  fields: z
    .array(
      z.object({
        label: shortText.min(1),
        value: z.string().max(4096),
        url: httpUrl.optional()
      })
    )
    .max(PLUGIN_TASK_DETAIL_FIELD_LIMIT)
    .optional()
})

export type PluginTaskDetailResult = z.infer<typeof pluginTaskDetailResultSchema>

/** Stable identity of one contributed provider across plugins. */
export function pluginTaskSourceKey(pluginKey: string, providerId: string): string {
  return `${pluginKey}/${providerId}`
}

type TaskProviderValidationManifest = {
  contributes: {
    commands: { id: string; action?: string }[]
    taskProviders: {
      id: string
      listCommand: string
      detailCommand?: string
      views: { id: string }[]
    }[]
  }
}

type IssueSink = {
  addIssue(issue: { code: 'custom'; path: (string | number)[]; message: string }): void
}

export function validatePluginTaskProviderContributions(
  manifest: TaskProviderValidationManifest,
  ctx: IssueSink
): void {
  const workerCommands = new Set(
    manifest.contributes.commands
      .filter((command) => command.action === undefined)
      .map((command) => command.id)
  )
  const providerIds = new Set<string>()
  for (const [index, provider] of manifest.contributes.taskProviders.entries()) {
    const path = ['contributes', 'taskProviders', index]
    if (providerIds.has(provider.id)) {
      ctx.addIssue({ code: 'custom', path, message: `duplicate taskProviders id: ${provider.id}` })
    }
    providerIds.add(provider.id)
    for (const field of ['listCommand', 'detailCommand'] as const) {
      const commandId = provider[field]
      if (commandId !== undefined && !workerCommands.has(commandId)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, field],
          message: `must name a worker command in contributes.commands: ${commandId}`
        })
      }
    }
    const viewIds = new Set<string>()
    for (const [viewIndex, view] of provider.views.entries()) {
      if (viewIds.has(view.id)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'views', viewIndex],
          message: `duplicate view id: ${view.id}`
        })
      }
      viewIds.add(view.id)
    }
  }
}
