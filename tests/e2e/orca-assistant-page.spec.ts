import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const NAV_BUTTON_NAME = /^(Orca Assistant|Orca 助手)$/
const NEW_CHAT_NAME = /^(New chat|新会话)$/
const ATTENTION_NAME = /agents need you|个智能体在等你/

function activeView(page: Parameters<typeof waitForSessionReady>[0]): Promise<string | undefined> {
  return page.evaluate(() => window.__store?.getState().activeView)
}

test('the Orca assistant is its own page, reachable from the sidebar and the shortcut', async ({
  orcaPage
}) => {
  await waitForSessionReady(orcaPage)

  await orcaPage.getByRole('button', { name: NAV_BUTTON_NAME }).click()
  await expect.poll(() => activeView(orcaPage)).toBe('assistant')
  const newChat = orcaPage.getByRole('main').getByRole('button', { name: NEW_CHAT_NAME })
  await expect(newChat).toBeVisible()

  // Both chat agents are offered for a new conversation.
  await newChat.click()
  await expect(orcaPage.getByRole('menuitem', { name: 'Claude' })).toBeVisible()
  await expect(orcaPage.getByRole('menuitem', { name: 'Codex' })).toBeVisible()
  await orcaPage.keyboard.press('Escape')

  // The shortcut comes back to the page from the workspace view.
  await orcaPage.evaluate(() => window.__store?.getState().closeAssistantPage())
  await expect.poll(() => activeView(orcaPage)).toBe('terminal')
  await orcaPage.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Alt+KeyO' : 'Control+Alt+KeyO'
  )
  await expect.poll(() => activeView(orcaPage)).toBe('assistant')

  // Agents stopped on a question surface as a count on the sidebar entry.
  const attention = orcaPage.getByRole('button', { name: ATTENTION_NAME })
  await expect(attention).toHaveCount(0)
  await orcaPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('Store unavailable')
    }
    const now = Date.now()
    const seed = (paneKey: string, state: 'waiting' | 'blocked'): void =>
      store
        .getState()
        .setAgentStatus(paneKey, { state, prompt: 'deploy?', agentType: 'codex' }, undefined, {
          updatedAt: now,
          stateStartedAt: now
        })
    seed('e2e-waiting-tab:11111111-1111-4111-8111-111111111111', 'waiting')
    seed('e2e-blocked-tab:22222222-2222-4222-8222-222222222222', 'blocked')
  })
  await expect(attention).toHaveText('2')
})
