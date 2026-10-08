import { ipcMain } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import type { DetectedOpenInApplication } from '../../shared/shell-open-types'
import { detectOpenInApplications } from '../open-in-app-detection'
import { loadOpenInAppIcons } from '../open-in-app-icons'

export function registerOpenInAppHandlers(): void {
  ipcMain.handle(
    'shell:getOpenInAppIcons',
    (_event, commands: string[]): Promise<Record<string, string>> =>
      loadOpenInAppIcons(Array.isArray(commands) ? commands : [])
  )

  ipcMain.handle('shell:detectOpenInApplications', (): DetectedOpenInApplication[] =>
    detectOpenInApplications({
      platform: process.platform,
      homePath: homedir(),
      localAppData: process.env.LOCALAPPDATA ?? null,
      pathEnv: process.env.PATH ?? process.env.Path ?? null,
      fileExists: existsSync,
      readDirectory: (directory) => readdirSync(directory),
      readTextFile: (path) => readFileSync(path, 'utf8')
    })
  )
}
