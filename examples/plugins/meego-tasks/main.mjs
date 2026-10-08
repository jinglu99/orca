// Meego task source for Orca's Tasks page. Every Meego call goes through the
// user's own `bytedcli` login, so no token is stored by this plugin.
import { runBytedcli, runBytedcliWithParams, unwrapMcpResult } from './bytedcli.mjs'
import {
  STORY_PAGE_SIZE,
  STORY_VIEWS,
  decodeItemId,
  isDoneStoryItem,
  meegoOrigin,
  parseMqlRows,
  storyMql,
  toStoryItem,
  toTaskDetail
} from './meego.mjs'

// Caps a space at 200 needs (4 MQL pages).
const MAX_PAGES = 4

const MAX_DISCOVERED_SPACES = 3
const resolvedSpaces = new Map()
let discoveredSpacesPromise = null

function cachedPromise(load, clear) {
  // Don't cache failures (e.g. not logged in yet).
  return load().catch((error) => {
    clear()
    throw error
  })
}

function resolveSpace(space) {
  if (!resolvedSpaces.has(space)) {
    resolvedSpaces.set(
      space,
      cachedPromise(
        async () => {
          const data = await runBytedcliWithParams(['meego', 'project', 'search'], {
            project_key: space
          })
          const project = unwrapMcpResult(data)?.projects?.[0]
          if (!project?.project_key) {
            throw new Error(`Meego space not found: ${space}`)
          }
          return project
        },
        () => resolvedSpaces.delete(space)
      )
    )
  }
  return resolvedSpaces.get(space)
}

/** `bytedcli meego config --space`, re-read on every list so changes apply on refresh. */
async function configuredSpace() {
  const config = await runBytedcli(['meego', 'config'])
  const space = typeof config?.space === 'string' ? config.space.trim() : ''
  return space ? resolveSpace(space) : null
}

/** Without a configured space: the spaces your todos live in. */
async function discoverSpaces() {
  const counts = new Map()
  for (const action of ['todo', 'done']) {
    const result = unwrapMcpResult(
      await runBytedcli(['meego', 'todo', 'list', '--action', action, '--page', '1'])
    )
    for (const todo of result?.list ?? []) {
      if (todo.project_key) {
        counts.set(todo.project_key, (counts.get(todo.project_key) ?? 0) + 1)
      }
    }
    if (counts.size > 0) {
      break
    }
  }
  if (counts.size === 0) {
    throw new Error('No Meego space found. Set one with `bytedcli meego config --space <空间>`.')
  }
  const keys = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DISCOVERED_SPACES)
    .map(([key]) => key)
  return Promise.all(keys.map(resolveSpace))
}

async function getStorySpaces() {
  const configured = await configuredSpace()
  if (configured) {
    return [configured]
  }
  discoveredSpacesPromise ??= cachedPromise(discoverSpaces, () => {
    discoveredSpacesPromise = null
  })
  return discoveredSpacesPromise
}

async function fetchStoryPage(project, page) {
  const data = await runBytedcliWithParams(['meego', 'workitem', 'list'], {
    project_key: project.project_key,
    mql: storyMql(project.project_key, page * STORY_PAGE_SIZE)
  })
  const origin = meegoOrigin(data?.endpoint)
  const { rows, total } = parseMqlRows(unwrapMcpResult(data))
  return { items: rows.map((row) => toStoryItem(row, { origin, project })), total }
}

/** First page reports the total; the rest (capped) are fetched in parallel. */
async function listSpaceStories(project) {
  const first = await fetchStoryPage(project, 0)
  const total = first.total ?? first.items.length
  const pageCount = Math.min(MAX_PAGES, Math.ceil(total / STORY_PAGE_SIZE))
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      fetchStoryPage(project, index + 1)
    )
  )
  return [first, ...rest].flatMap((page) => page.items)
}

async function listStories(view) {
  const spaces = await getStorySpaces()
  const items = (await Promise.all(spaces.map(listSpaceStories))).flat()
  const visible = view === 'stories-active' ? items.filter((item) => !isDoneStoryItem(item)) : items
  return visible.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export default function activate(orca) {
  orca.commands.register('meego.list', async (args) => {
    const view = typeof args?.view === 'string' ? args.view : 'stories-active'
    if (!STORY_VIEWS.has(view)) {
      throw new Error(`unknown Meego view: ${view}`)
    }
    return { items: await listStories(view) }
  })

  orca.commands.register('meego.detail', async (args) => {
    const { projectKey, workItemId } = decodeItemId(args?.itemId)
    const data = await runBytedcli([
      'meego',
      'workitem',
      'get',
      '--project-key',
      projectKey,
      '--work-item-id',
      workItemId
    ])
    const detail = unwrapMcpResult(data)
    return toTaskDetail(detail, { origin: meegoOrigin(data?.endpoint), projectKey, workItemId })
  })
}
