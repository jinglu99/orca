import path from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'

const ORCA_ASSISTANT_DIRNAME = 'orca-assistant'

export function getOrcaAssistantWorkspacePath(): string {
  return path.join(getAppEnvironment().getPath('userData'), ORCA_ASSISTANT_DIRNAME)
}

export function isOrcaAssistantWorkspacePath(candidate: string | undefined): boolean {
  return (
    !!candidate &&
    hasAppEnvironment() &&
    path.resolve(candidate) === path.resolve(getOrcaAssistantWorkspacePath())
  )
}
