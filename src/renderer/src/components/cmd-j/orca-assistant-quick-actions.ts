import { Bot, MessageCircleQuestion } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { openOrcaAssistant, orcaAssistantAttentionPrompt } from '@/lib/orca-assistant'
import type { CmdJQuickAction } from './quick-actions'

export function getOrcaAssistantQuickActions(): CmdJQuickAction[] {
  return [
    {
      id: 'open-orca-assistant',
      kind: 'action',
      title: translate('orcaAssistant.quickAction.open', 'Ask Orca Assistant'),
      description: translate(
        'orcaAssistant.quickAction.openDescription',
        'Chat with an agent that can see and operate your worktrees and agents.'
      ),
      icon: Bot,
      verbKeywords: [
        translate('orcaAssistant.quickAction.verbs.assistant', 'assistant'),
        translate('orcaAssistant.quickAction.verbs.ask', 'ask orca'),
        translate('orcaAssistant.quickAction.verbs.bot', 'bot')
      ],
      isAvailable: () => ({ available: true }),
      run: async () => {
        await openOrcaAssistant()
        return { status: 'ok' }
      }
    },
    {
      id: 'orca-assistant-attention',
      kind: 'action',
      title: translate('orcaAssistant.quickAction.attention', 'Which Agents Need Me?'),
      description: translate(
        'orcaAssistant.quickAction.attentionDescription',
        'Ask the Orca assistant which agents are waiting for you and what they need.'
      ),
      icon: MessageCircleQuestion,
      verbKeywords: [
        translate('orcaAssistant.quickAction.verbs.waiting', 'waiting agents'),
        translate('orcaAssistant.quickAction.verbs.blocked', 'blocked agents'),
        translate('orcaAssistant.quickAction.verbs.needsAttention', 'needs attention')
      ],
      isAvailable: () => ({ available: true }),
      run: async () => {
        await openOrcaAssistant({ prompt: orcaAssistantAttentionPrompt() })
        return { status: 'ok' }
      }
    }
  ]
}
