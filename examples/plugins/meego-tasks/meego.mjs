// Maps bytedcli Meego payloads onto Orca's plugin task-provider shapes
// (src/shared/plugins/plugin-task-provider.ts). Pure functions; no I/O.

export const DEFAULT_MEEGO_ORIGIN = 'https://meego.larkoffice.com'

/** Story views backed by MQL: needs the current user participates in. */
export const STORY_VIEWS = new Set(['stories-active', 'stories'])

const DONE_STATUS_KEYS = new Set(['end', 'closed', 'done', 'finished'])
const DONE_STATUS_NAME = /完成|关闭|终止/

export function meegoOrigin(endpoint) {
  try {
    return endpoint ? new URL(endpoint).origin : DEFAULT_MEEGO_ORIGIN
  } catch {
    return DEFAULT_MEEGO_ORIGIN
  }
}

export function encodeItemId(projectKey, workItemId) {
  return `${projectKey}:${workItemId}`
}

export function decodeItemId(itemId) {
  const match = /^([A-Za-z0-9_-]+):(\d+)$/.exec(String(itemId))
  if (!match) {
    throw new Error(`invalid Meego item id: ${itemId}`)
  }
  return { projectKey: match[1], workItemId: match[2] }
}

function names(people) {
  return Array.isArray(people) ? people.map((person) => person?.name).filter(Boolean) : []
}

function fieldByKey(detail, key) {
  return detail?.work_item_fields?.find((field) => field.key === key)
}

function isDone(status) {
  return Boolean(
    status && (DONE_STATUS_KEYS.has(status.key) || DONE_STATUS_NAME.test(status.name ?? ''))
  )
}

function itemUrl(origin, simpleName, typeKey, workItemId) {
  return simpleName ? `${origin}/${simpleName}/${typeKey}/detail/${workItemId}` : undefined
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function formatTime(value) {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

const SUMMARY_FIELD_KEYS = new Set(['priority', 'current_status_operator'])

/** `workitem get` payload → PluginTaskDetailResult. */
export function toTaskDetail(detail, { origin, projectKey, workItemId, projectName }) {
  const attribute = detail?.work_item_attribute ?? {}
  const typeKey = attribute.work_item_type?.key ?? 'story'
  const status = attribute.work_item_status
  const priority = fieldByKey(detail, 'priority')?.value?.label
  const operators = names(fieldByKey(detail, 'current_status_operator')?.value)
  const url = itemUrl(origin, attribute.owned_project?.simple_name, typeKey, workItemId)
  const item = {
    id: encodeItemId(projectKey, workItemId),
    key: workItemId,
    title: truncate(attribute.work_item_name || workItemId, 1024),
    ...(url ? { url } : {}),
    ...(status?.name
      ? { status: { label: truncate(status.name, 64), tone: isDone(status) ? 'success' : 'info' } }
      : {}),
    ...((attribute.owned_project?.name ?? projectName)
      ? { project: truncate(attribute.owned_project?.name ?? projectName, 128) }
      : {}),
    ...(attribute.update_time ? { updatedAt: attribute.update_time } : {})
  }

  const fields = []
  const push = (label, value, link) => {
    if (fields.length >= 64 || (!value && !link)) {
      return
    }
    fields.push({
      label: truncate(label, 64),
      value: truncate(String(value ?? ''), 4000),
      ...(link ? { url: link } : {})
    })
  }
  const typeLabel = [attribute.work_item_type?.name, attribute.template?.name]
    .filter(Boolean)
    .join(' · ')
  push('类型', typeLabel)
  push('状态', status?.name)
  push('优先级', priority)
  const nodes = (detail?.work_item_current_node ?? []).map((node) => {
    const owners = names(node.owners)
    return owners.length > 0 ? `${node.name}（${owners.join('、')}）` : node.name
  })
  push('当前节点', nodes.join('\n'))
  push('当前负责人', operators.join('、'))
  for (const role of attribute.role_members ?? []) {
    const members = names(role.members)
    if (members.length > 0) {
      push(role.name ?? role.key, members.join('、'))
    }
  }
  push('创建人', attribute.create_by?.name)
  push('创建时间', formatTime(attribute.create_time))
  push('更新时间', formatTime(attribute.update_time))
  for (const field of detail?.work_item_fields ?? []) {
    if (SUMMARY_FIELD_KEYS.has(field.key)) {
      continue
    }
    if (isHttpUrl(field.value)) {
      push(field.name ?? field.key, field.value, field.value)
    } else if (typeof field.value?.label === 'string') {
      push(field.name ?? field.key, field.value.label)
    }
  }
  return { item, fields }
}

export const STORY_PAGE_SIZE = 50

/** MQL for needs in one space that the current user participates in, newest first. */
export function storyMql(projectKey, offset) {
  if (!/^[A-Za-z0-9_-]+$/.test(projectKey)) {
    throw new Error(`invalid Meego project key: ${projectKey}`)
  }
  return [
    'SELECT `work_item_id`, `name`, `work_item_status`, `priority`, `updated_at`,',
    '`current_status_operator`, in_progress_nodes_name()',
    `FROM \`${projectKey}\`.\`story\``,
    'WHERE array_contains(all_participate_persons(), current_login_user())',
    'ORDER BY `updated_at` DESC',
    `LIMIT ${offset}, ${STORY_PAGE_SIZE}`
  ].join(' ')
}

/** `workitem list` (search_by_mql) result → rows keyed by field key, plus total count. */
export function parseMqlRows(result) {
  const rows = Object.values(result?.data ?? {}).flat()
  const total = result?.list?.[0]?.count
  return {
    rows: rows.map((row) => {
      const fields = {}
      for (const field of row?.moql_field_list ?? []) {
        // Function columns (in_progress_nodes_name) come back under a hashed key.
        const key =
          field.value_type === 'quick_complete_value_list' ? 'in_progress_nodes' : field.key
        fields[key] = field.value
      }
      return fields
    }),
    total: typeof total === 'number' ? total : null
  }
}

function mqlDateToIso(value) {
  // MQL returns local wall time ("2026-09-20 17:33:08"); `T` makes Date parse it as local.
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value)
    ? value.replace(' ', 'T')
    : undefined
}

/** One MQL story row → PluginTaskItem. `project` is the resolved space. */
export function toStoryItem(fields, { origin, project }) {
  const workItemId = String(fields.work_item_id?.long_value ?? '')
  const statusLabel = fields.work_item_status?.key_label_value_list?.[0]?.label
  const priority = fields.priority?.key_label_value?.label
  const nodes = (fields.in_progress_nodes?.quick_complete_value_list ?? [])
    .map((node) => node?.name)
    .filter(Boolean)
  const operators = (fields.current_status_operator?.user_value_list ?? [])
    .map((user) => user?.name_cn || user?.name_en)
    .filter(Boolean)
  const labels = [
    ...nodes.slice(0, 2),
    ...(nodes.length > 2 ? [`+${nodes.length - 2}`] : []),
    priority
  ]
    .filter((label) => typeof label === 'string' && label.length > 0)
    .map((label) => truncate(label, 64))
  const url = itemUrl(origin, project.simple_name, 'story', workItemId)
  const updatedAt = mqlDateToIso(fields.updated_at?.string_value)
  return {
    id: encodeItemId(project.project_key, workItemId),
    key: workItemId,
    title: truncate(fields.name?.string_value || workItemId, 1024),
    ...(url ? { url } : {}),
    ...(statusLabel
      ? {
          status: {
            label: truncate(statusLabel, 64),
            tone: DONE_STATUS_NAME.test(statusLabel) ? 'success' : 'info'
          }
        }
      : {}),
    ...(project.name ? { project: truncate(project.name, 128) } : {}),
    ...(labels.length > 0 ? { labels } : {}),
    ...(operators.length > 0 ? { assignees: operators.slice(0, 3) } : {}),
    ...(updatedAt ? { updatedAt } : {})
  }
}

export function isDoneStoryItem(item) {
  return item.status?.tone === 'success'
}
