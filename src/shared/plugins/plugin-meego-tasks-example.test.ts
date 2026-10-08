import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { pluginManifestSchema } from './plugin-manifest'
import { pluginTaskDetailResultSchema, pluginTaskItemSchema } from './plugin-task-provider'

const root = join(process.cwd(), 'examples', 'plugins', 'meego-tasks')

type MeegoMapping = {
  storyMql: (projectKey: string, offset: number) => string
  parseMqlRows: (result: unknown) => { rows: Record<string, unknown>[]; total: number | null }
  toStoryItem: (fields: Record<string, unknown>, options: Record<string, unknown>) => unknown
  toTaskDetail: (detail: unknown, options: Record<string, unknown>) => unknown
  decodeItemId: (itemId: string) => { projectKey: string; workItemId: string }
}

async function loadMapping(): Promise<MeegoMapping> {
  // Untyped JS module: `import()` resolves to `any`, so this annotation checks nothing at
  // runtime; the assertions below exercise every export used.
  const mapping: MeegoMapping = await import(pathToFileURL(join(root, 'meego.mjs')).href)
  return mapping
}

// Trimmed from real `bytedcli meego workitem get` output.
const PROJECT_KEY = '5bebafa4956c37218e2cf5c3'
const detail = {
  work_item_attribute: {
    create_by: { name: '许添翼' },
    create_time: '2024-11-22T13:24:02+08:00',
    owned_project: { key: '5bebafa4956c37218e2cf5c3', name: '抖音', simple_name: 'aweme' },
    role_members: [
      { key: 'QA', name: 'QA', members: [{ name: '肖云森' }] },
      { key: 'PM', name: 'PM' }
    ],
    template: { name: '技术需求' },
    update_time: '2026-09-28T19:21:17+08:00',
    work_item_id: '5490410080',
    work_item_name: '【技术需求】热点频道下线剪映和店铺标签',
    work_item_status: { key: 'end', name: '已完成' },
    work_item_type: { key: 'story', name: '需求' }
  },
  work_item_current_node: [{ id: 'state_1', name: '质量统计', owners: [{ name: '汪京陆' }] }],
  work_item_fields: [
    { key: 'business', name: '业务线', value: '6348de6afcde1f2b41b36ccb' },
    { key: 'current_status_operator', name: '当前负责人', value: [{ name: '汪京陆' }] },
    { key: 'priority', name: '优先级', value: { label: 'P0', value: '0' } },
    { key: 'wiki', name: 'PRD', value: 'https://bytedance.larkoffice.com/docx/abc' }
  ]
}

describe('Meego tasks example plugin', () => {
  it('ships a manifest whose task provider passes host validation', async () => {
    const manifest = pluginManifestSchema.parse(
      JSON.parse(await readFile(join(root, 'orca-plugin.json'), 'utf8'))
    )
    expect(manifest.contributes.taskProviders.map((provider) => provider.id)).toEqual(['meego'])
    const workerModule: { default?: unknown } = await import(
      pathToFileURL(join(root, manifest.main!)).href
    )
    expect(workerModule.default).toBeTypeOf('function')
  })

  it('maps a work item into detail fields, keeping links and skipping raw ids', async () => {
    const { toTaskDetail } = await loadMapping()
    const result = pluginTaskDetailResultSchema.parse(
      toTaskDetail(detail, {
        origin: 'https://meego.larkoffice.com',
        projectKey: PROJECT_KEY,
        workItemId: '5490410080'
      })
    )
    const labels = result.fields?.map((field) => field.label)
    expect(labels).toContain('当前节点')
    expect(labels).not.toContain('业务线')
    expect(result.fields?.find((field) => field.label === 'PRD')?.url).toBe(
      'https://bytedance.larkoffice.com/docx/abc'
    )
    expect(result.fields?.find((field) => field.label === 'QA')?.value).toBe('肖云森')
  })

  it('rejects malformed item ids before they reach bytedcli', async () => {
    const { decodeItemId } = await loadMapping()
    expect(() => decodeItemId('abc:12;rm -rf')).toThrow(/invalid Meego item id/)
  })

  it('maps MQL story rows, including the hashed in-progress-nodes column', async () => {
    const { parseMqlRows, toStoryItem } = await loadMapping()
    // Trimmed from real `bytedcli meego workitem list --mql` output.
    const { rows, total } = parseMqlRows({
      data: {
        '1': [
          {
            moql_field_list: [
              { key: 'work_item_id', value: { long_value: 7330791057 }, value_type: 'long_value' },
              {
                key: 'name',
                value: { string_value: '媒体流量激励实验' },
                value_type: 'string_value'
              },
              {
                key: 'work_item_status',
                value: { key_label_value_list: [{ key: 'x', label: '14.收益回收中' }] },
                value_type: 'key_label_value_list'
              },
              {
                key: 'priority',
                value: { key_label_value: { key: '0', label: 'P0' } },
                value_type: 'key_label_value'
              },
              {
                key: 'updated_at',
                value: { string_value: '2026-09-20 17:33:08' },
                value_type: 'string_value'
              },
              {
                key: 'current_status_operator',
                value: { user_value_list: [{ name_cn: '蔡璐璐' }] },
                value_type: 'user_value_list'
              },
              {
                key: 'fc66fa8a3a0fc6788aec3ccb72fc819f',
                value: {
                  quick_complete_value_list: [
                    { name: 'AB方案' },
                    { name: '安全检查' },
                    { name: 'PM验收' }
                  ]
                },
                value_type: 'quick_complete_value_list'
              }
            ]
          }
        ]
      },
      list: [{ count: 72 }]
    })
    expect(total).toBe(72)
    const item = pluginTaskItemSchema.parse(
      toStoryItem(rows[0]!, {
        origin: 'https://meego.larkoffice.com',
        project: { project_key: '5bebafa4956c37218e2cf5c3', name: '抖音', simple_name: 'aweme' }
      })
    )
    expect(item).toMatchObject({
      id: '5bebafa4956c37218e2cf5c3:7330791057',
      title: '媒体流量激励实验',
      url: 'https://meego.larkoffice.com/aweme/story/detail/7330791057',
      status: { label: '14.收益回收中', tone: 'info' },
      project: '抖音',
      labels: ['AB方案', '安全检查', '+1', 'P0'],
      assignees: ['蔡璐璐'],
      updatedAt: '2026-09-20T17:33:08'
    })
  })

  it('builds participant MQL only for well-formed project keys', async () => {
    const { storyMql } = await loadMapping()
    expect(storyMql('aweme', 50)).toContain('FROM `aweme`.`story`')
    expect(storyMql('aweme', 50)).toContain('LIMIT 50, 50')
    expect(() => storyMql('aweme` OR 1=1', 0)).toThrow(/invalid Meego project key/)
  })
})
