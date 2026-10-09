// The Orca assistant is an ordinary agent CLI started in an app-owned folder whose instruction
// files teach it to operate Orca through the `orca` CLI. Instruction files are the one hook every
// agent and both terminal and chat views honour, so no launch path needs to know about it.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { prependOrcaCliDirToChildPath } from '../cli/orca-cli-child-path'
import { ORCA_ASSISTANT_INSTRUCTIONS } from './orca-assistant-instructions'
import { getOrcaAssistantWorkspacePath } from './orca-assistant-location'
import { orcaAssistantMcpFiles, type OrcaAssistantCli } from './orca-assistant-mcp-config'

/** AGENTS.md serves Codex, OpenCode and most other agents; Claude reads CLAUDE.md, which imports it. */
const INSTRUCTION_FILES: readonly (readonly [name: string, content: string])[] = [
  ['AGENTS.md', ORCA_ASSISTANT_INSTRUCTIONS],
  ['CLAUDE.md', '@AGENTS.md\n']
]

/** This app's own CLI launcher, so the assistant's tools reach this instance, dev or packaged. */
export function resolveThisAppCli(): OrcaAssistantCli | null {
  const app = getAppEnvironment()
  const userDataPath = app.getPath('userData')
  const launcher = prependOrcaCliDirToChildPath(
    {},
    { isPackaged: app.isPackaged(), userDataPath, resourcesPath: process.resourcesPath ?? null }
  )
  return launcher ? { launcher, userDataPath } : null
}

async function writeIfChanged(filePath: string, content: string): Promise<void> {
  const current = await readFile(filePath, 'utf8').catch(() => null)
  if (current !== content) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }
}

/** Creates the folder and refreshes its files so they always match this Orca build. */
export async function ensureOrcaAssistantWorkspace(
  dirPath: string = getOrcaAssistantWorkspacePath(),
  cli: OrcaAssistantCli | null = resolveThisAppCli()
): Promise<string> {
  await mkdir(dirPath, { recursive: true })
  const files = [...INSTRUCTION_FILES, ...(cli ? orcaAssistantMcpFiles(cli) : [])]
  await Promise.all(
    files.map(([name, content]) => writeIfChanged(path.join(dirPath, name), content))
  )
  return dirPath
}
