export type ShellOpenExternalEditorRequest = {
  path: string
  command?: string
  connectionId?: string | null
}

export type ShellOpenPathFailureReason =
  | 'not-absolute'
  | 'not-found'
  | 'launch-failed'
  /** The configured editor command could not be found on this machine. */
  | 'editor-command-not-found'
  | 'remote-runtime-unsupported'
  | 'ssh-target-not-found'
  | 'ssh-target-invalid'
  | 'ssh-alias-required'
  | 'remote-editor-unsupported'

export type ShellOpenLocalPathFailureReason = Extract<
  ShellOpenPathFailureReason,
  'not-absolute' | 'not-found' | 'launch-failed' | 'remote-runtime-unsupported'
>

export type ShellOpenLocalPathResult =
  | { ok: true }
  | { ok: false; reason: ShellOpenLocalPathFailureReason }

export type ShellOpenExternalEditorResult =
  | { ok: true }
  | {
      ok: false
      reason: Exclude<ShellOpenPathFailureReason, 'ssh-alias-required' | 'editor-command-not-found'>
    }
  | { ok: false; reason: 'ssh-alias-required'; host: string; port: number }
  /** Carries the command so the message can name what to fix instead of saying "check your config". */
  | { ok: false; reason: 'editor-command-not-found'; command: string }

export type DetectedOpenInApplication = {
  command: string
  label: string
  source: 'path' | 'jetbrains-toolbox'
}
