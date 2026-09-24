import { describe, expect, it } from 'vitest'
import { detectOpenInApplications, type OpenInAppDetectionDeps } from './open-in-app-detection'

const MAC_SCRIPTS = '/Users/dev/Library/Application Support/JetBrains/Toolbox/scripts'

function deps(overrides: Partial<OpenInAppDetectionDeps> = {}): OpenInAppDetectionDeps {
  return {
    platform: 'darwin',
    homePath: '/Users/dev',
    pathEnv: null,
    fileExists: () => false,
    readDirectory: () => [],
    ...overrides
  }
}

describe('detectOpenInApplications', () => {
  it('finds JetBrains IDEs by the launchers Toolbox generated', () => {
    const found = detectOpenInApplications(
      deps({ readDirectory: (path) => (path === MAC_SCRIPTS ? ['goland', 'clion'] : []) })
    )

    expect(found).toEqual([
      { command: 'goland', label: 'GoLand', source: 'jetbrains-toolbox' },
      { command: 'clion', label: 'CLion', source: 'jetbrains-toolbox' }
    ])
  })

  it('offers an unmapped Toolbox launcher under its own name', () => {
    // Why not dropped: the script exists, so it launches something; a missing label entry is our
    // gap, not evidence that the IDE is absent.
    const found = detectOpenInApplications(deps({ readDirectory: () => ['brand-new-ide'] }))

    expect(found).toEqual([
      { command: 'brand-new-ide', label: 'brand-new-ide', source: 'jetbrains-toolbox' }
    ])
  })

  it('finds editors that installed a CLI shim on PATH', () => {
    const found = detectOpenInApplications(
      deps({
        pathEnv: '/usr/local/bin:/opt/homebrew/bin',
        fileExists: (path) => path === '/usr/local/bin/code' || path === '/opt/homebrew/bin/zed'
      })
    )

    expect(found.map((app) => app.command)).toEqual(['code', 'zed'])
    expect(found.every((app) => app.source === 'path')).toBe(true)
  })

  it('strips the Windows shim extension so the stored command matches POSIX', () => {
    const found = detectOpenInApplications(
      deps({
        platform: 'win32',
        homePath: 'C:\\Users\\dev',
        localAppData: 'C:\\Users\\dev\\AppData\\Local',
        readDirectory: () => ['goland.cmd']
      })
    )

    expect(found).toEqual([{ command: 'goland', label: 'GoLand', source: 'jetbrains-toolbox' }])
  })

  it('splits PATH with the platform separator', () => {
    const found = detectOpenInApplications(
      deps({
        platform: 'win32',
        homePath: 'C:\\Users\\dev',
        pathEnv: 'C:\\tools;C:\\apps',
        fileExists: (path) => path === 'C:\\apps\\cursor.cmd'
      })
    )

    expect(found.map((app) => app.command)).toEqual(['cursor'])
  })

  it('reports each command once when both sources see it', () => {
    const found = detectOpenInApplications(
      deps({
        readDirectory: () => ['goland'],
        pathEnv: '/usr/local/bin',
        fileExists: (path) => path === '/usr/local/bin/goland'
      })
    )

    expect(found).toHaveLength(1)
    expect(found[0].source).toBe('jetbrains-toolbox')
  })

  it('finds nothing on a machine with no editors installed', () => {
    expect(detectOpenInApplications(deps())).toEqual([])
  })

  it('survives an unreadable Toolbox directory', () => {
    const found = detectOpenInApplications(
      deps({
        readDirectory: () => {
          throw new Error('EACCES')
        }
      })
    )
    expect(found).toEqual([])
  })
})

describe('detectOpenInApplications with stale Toolbox launchers', () => {
  const TOOLBOX_SCRIPT = (appPath: string) => `#!/bin/bash\nopen -na "${appPath}" --args\n`

  it('drops an IDE whose application Toolbox left behind', () => {
    // Why: uninstalling from Toolbox removes the app but keeps the launcher, so the script alone
    // would advertise products the user no longer has.
    const found = detectOpenInApplications(
      deps({
        readDirectory: () => ['goland', 'clion'],
        readTextFile: (path) =>
          path.endsWith('goland')
            ? TOOLBOX_SCRIPT('/Users/dev/Applications/GoLand.app/Contents/MacOS/goland')
            : TOOLBOX_SCRIPT('/Users/dev/Applications/CLion.app/Contents/MacOS/clion'),
        fileExists: (path) => path === '/Users/dev/Applications/GoLand.app'
      })
    )

    expect(found.map((app) => app.command)).toEqual(['goland'])
  })

  it('keeps a launcher whose script cannot be read rather than hiding an installed IDE', () => {
    const found = detectOpenInApplications(
      deps({
        readDirectory: () => ['goland'],
        readTextFile: () => {
          throw new Error('EACCES')
        }
      })
    )

    expect(found.map((app) => app.command)).toEqual(['goland'])
  })

  it('keeps every launcher off macOS, where the target is not named', () => {
    const found = detectOpenInApplications(
      deps({
        platform: 'win32',
        homePath: 'C:\\Users\\dev',
        localAppData: 'C:\\Users\\dev\\AppData\\Local',
        readDirectory: () => ['goland.cmd'],
        readTextFile: () => 'rem shim'
      })
    )

    expect(found.map((app) => app.command)).toEqual(['goland'])
  })
})
