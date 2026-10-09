import { useState } from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  normalizeTerminalEnvironmentVariables,
  parseTerminalEnvironmentDraft,
  stringifyTerminalEnvironmentDraft
} from '../../../../shared/terminal-environment-variables'
import { Textarea } from '../ui/textarea'
import { SettingsSubsectionHeader } from './SettingsFormControls'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'

type TerminalEnvironmentSectionProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function TerminalEnvironmentSection({
  settings,
  updateSettings
}: TerminalEnvironmentSectionProps): React.JSX.Element {
  const saved = stringifyTerminalEnvironmentDraft(
    normalizeTerminalEnvironmentVariables(settings.terminalEnvironmentVariables)
  )
  const [draft, setDraft] = useState(saved)
  const [prevSaved, setPrevSaved] = useState(saved)
  const [tooLarge, setTooLarge] = useState(false)
  if (saved !== prevSaved) {
    // Why: settings can change outside this pane; follow the persisted value once it does.
    setPrevSaved(saved)
    setDraft(saved)
  }
  const title = translate('settings.terminalEnvironment.title', 'Environment Variables')
  const description = translate(
    'settings.terminalEnvironment.description',
    'Variables added to every new terminal on this computer, in all workspaces.'
  )
  const commit = (): void => {
    const parsed = parseTerminalEnvironmentDraft(draft)
    setTooLarge(parsed.tooLarge)
    if (!parsed.tooLarge) {
      updateSettings({ terminalEnvironmentVariables: parsed.env })
    }
  }

  return (
    <section key="environment" className="space-y-3">
      <SettingsSubsectionHeader title={title} description={description} />
      <SearchableSetting
        title={title}
        description={description}
        keywords={['env', 'environment', 'variables', 'export']}
      >
        <div className="space-y-2 py-2">
          <Textarea
            variant="code"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setTooLarge(false)
            }}
            onBlur={commit}
            placeholder={translate(
              'settings.terminalEnvironment.placeholder',
              'API_BASE_URL=http://localhost:8080\nNODE_OPTIONS=--max-old-space-size=8192'
            )}
            spellCheck={false}
            aria-label={title}
            aria-invalid={tooLarge || undefined}
            className="min-h-24"
          />
          {tooLarge ? (
            <p role="alert" className="text-[11px] text-destructive">
              {translate(
                'settings.terminalEnvironment.tooLarge',
                'This text is too large to save. Shorten it and try again.'
              )}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {translate(
              'settings.terminalEnvironment.hint',
              'One NAME=value per line; lines starting with # are ignored. Values are used as written, so $VAR is not expanded. New terminals only; SSH terminals and names starting with ORCA_ are skipped. Saved in plain text, so keep secrets out.'
            )}
          </p>
        </div>
      </SearchableSetting>
    </section>
  )
}
