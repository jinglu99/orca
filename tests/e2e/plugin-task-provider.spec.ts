/**
 * Invariant: a plugin's contributed task provider shows up as a Tasks source,
 * lists and previews items through its worker commands, and leaves the
 * built-in sources untouched when the user switches back.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from './helpers/orca-app'

const MANIFEST = {
  manifestVersion: 1,
  id: 'tracker-tasks',
  publisher: 'orca-e2e',
  name: 'Tracker Tasks',
  version: '1.0.0',
  engines: { orca: '>=1.0.0' },
  pluginApi: 1,
  main: 'main.mjs',
  contributes: {
    commands: [
      { id: 'tracker.list', title: 'Tracker: List' },
      { id: 'tracker.detail', title: 'Tracker: Detail' }
    ],
    taskProviders: [
      {
        id: 'tracker',
        title: 'Tracker',
        icon: 'flag',
        listCommand: 'tracker.list',
        detailCommand: 'tracker.detail',
        views: [
          { id: 'open', title: 'Open' },
          { id: 'closed', title: 'Closed' }
        ]
      }
    ]
  },
  capabilities: []
}

const WORKER = `
const ITEMS = {
  open: [
    { id: 'TRK-1', key: 'TRK-1', title: 'Fix login redirect', status: { label: 'In progress', tone: 'info' }, project: 'Web', labels: ['P0'] },
    { id: 'TRK-2', key: 'TRK-2', title: 'Ship billing export', status: { label: 'Todo' }, project: 'Billing' }
  ],
  closed: [{ id: 'TRK-9', key: 'TRK-9', title: 'Retire legacy cron', status: { label: 'Done', tone: 'success' } }]
}
export default function activate(orca) {
  orca.commands.register('tracker.list', async (args) => ({ items: ITEMS[args?.view] ?? [] }))
  orca.commands.register('tracker.detail', async (args) => {
    const item = [...ITEMS.open, ...ITEMS.closed].find((candidate) => candidate.id === args?.itemId)
    if (!item) throw new Error('unknown item ' + args?.itemId)
    return { item, fields: [{ label: 'Reporter', value: 'Ada' }], description: 'Steps to reproduce' }
  })
}
`

test('lists, previews, and leaves a plugin task source', async ({ orcaPage }) => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'orca-task-provider-e2e-'))
  const pluginRoot = join(tempRoot, 'tracker-tasks')
  await mkdir(pluginRoot)
  await writeFile(join(pluginRoot, 'orca-plugin.json'), JSON.stringify(MANIFEST, null, 2))
  await writeFile(join(pluginRoot, 'main.mjs'), WORKER)

  try {
    await orcaPage.evaluate(async (sourcePath) => {
      const settings = await window.api.settings.set({ pluginSystemEnabled: true })
      window.__store?.setState({ settings })
      const result = await window.api.plugins.install({ kind: 'local-path', path: sourcePath })
      if (!result.ok) {
        throw new Error(result.error)
      }
      const entry = (await window.api.plugins.refresh()).find(
        (candidate) => candidate.pluginKey === result.pluginKey
      )
      if (!entry?.consentFingerprint) {
        throw new Error('installed plugin was not listed for consent')
      }
      await window.api.plugins.consent({
        pluginKey: result.pluginKey,
        reviewedFingerprint: entry.consentFingerprint,
        decision: 'approve'
      })
      window.__store?.getState().openTaskPage()
    }, pluginRoot)

    const sourceButton = orcaPage.locator('[data-task-source="orca-e2e.tracker-tasks/tracker"]')
    await expect(sourceButton).toBeVisible({ timeout: 15_000 })
    await sourceButton.click()
    await expect(sourceButton).toHaveAttribute('aria-pressed', 'true')

    await expect(orcaPage.getByText('Fix login redirect')).toBeVisible()
    await expect(orcaPage.getByText('Ship billing export')).toBeVisible()

    await orcaPage.locator('input[type="search"]').fill('billing')
    await expect(orcaPage.getByText('Fix login redirect')).toBeHidden()
    await expect(orcaPage.getByText('Ship billing export')).toBeVisible()
    await orcaPage.locator('input[type="search"]').fill('')

    await orcaPage.getByRole('radio', { name: 'Closed' }).click()
    await expect(orcaPage.getByText('Retire legacy cron')).toBeVisible()
    await expect(orcaPage.getByText('Fix login redirect')).toBeHidden()

    await orcaPage.getByText('Retire legacy cron').click()
    const sheet = orcaPage.getByRole('dialog', { name: 'Retire legacy cron' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Reporter')).toBeVisible()
    await expect(sheet.getByText('Steps to reproduce')).toBeVisible()

    // Esc closes the preview, not the whole Tasks page.
    await orcaPage.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(sourceButton).toBeVisible()

    // Switching to a built-in source leaves plugin mode.
    await orcaPage.locator('[data-task-source="github"]').click()
    await expect(sourceButton).toHaveAttribute('aria-pressed', 'false')
    await expect(orcaPage.getByText('Retire legacy cron')).toBeHidden()
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
