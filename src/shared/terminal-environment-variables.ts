import { isClipboardTextByteLengthOverLimit } from './clipboard-text'

// Why: pane identity and hook coordinates must stay Orca-owned, or agent status routing breaks.
const RESERVED_NAME_PREFIX = 'ORCA_'

export const TERMINAL_ENVIRONMENT_DRAFT_MAX_BYTES = 16 * 1024

export type TerminalEnvironmentDraftParseResult = {
  env: Record<string, string>
  tooLarge: boolean
}

function isUsableName(name: string): boolean {
  return (
    name.length > 0 &&
    !name.includes('=') &&
    !name.includes('\0') &&
    !name.toUpperCase().startsWith(RESERVED_NAME_PREFIX)
  )
}

export function normalizeTerminalEnvironmentVariables(value: unknown): Record<string, string> {
  const normalized: Record<string, string> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized
  }
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim()
    // A NUL byte makes the whole spawn throw, so drop just that entry.
    if (isUsableName(name) && typeof rawValue === 'string' && !rawValue.includes('\0')) {
      normalized[name] = rawValue
    }
  }
  return normalized
}

export function stringifyTerminalEnvironmentDraft(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n')
}

/** One `NAME=value` per line; blank lines and `#` comments are skipped, values keep their spaces. */
export function parseTerminalEnvironmentDraft(draft: string): TerminalEnvironmentDraftParseResult {
  if (isClipboardTextByteLengthOverLimit(draft, TERMINAL_ENVIRONMENT_DRAFT_MAX_BYTES)) {
    return { env: {}, tooLarge: true }
  }
  const env: Record<string, string> = {}
  for (const line of draft.split(/\r?\n/)) {
    const trimmed = line.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (!trimmed || trimmed.startsWith('#') || separatorIndex <= 0) {
      continue
    }
    const name = trimmed
      .slice(0, separatorIndex)
      .replace(/^export\s+/, '')
      .trim()
    env[name] = trimmed.slice(separatorIndex + 1)
  }
  return { env: normalizeTerminalEnvironmentVariables(env), tooLarge: false }
}
