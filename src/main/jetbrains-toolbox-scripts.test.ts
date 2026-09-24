import { describe, expect, it } from 'vitest'
import {
  getJetBrainsToolboxScriptDirectories,
  resolveJetBrainsToolboxScript
} from './jetbrains-toolbox-scripts'

const MAC_SCRIPTS = '/Users/dev/Library/Application Support/JetBrains/Toolbox/scripts'
const LINUX_SCRIPTS = '/home/dev/.local/share/JetBrains/Toolbox/scripts'
const WINDOWS_SCRIPTS = 'C:\\Users\\dev\\AppData\\Local\\JetBrains\\Toolbox\\scripts'

function existsOnly(...paths: string[]): (path: string) => boolean {
  const present = new Set(paths)
  return (path) => present.has(path)
}

describe('getJetBrainsToolboxScriptDirectories', () => {
  it('uses the macOS Application Support location', () => {
    expect(getJetBrainsToolboxScriptDirectories('darwin', '/Users/dev')).toEqual([MAC_SCRIPTS])
  })

  it('uses the XDG data location on Linux', () => {
    expect(getJetBrainsToolboxScriptDirectories('linux', '/home/dev')).toEqual([LINUX_SCRIPTS])
  })

  it('uses LOCALAPPDATA on Windows', () => {
    expect(
      getJetBrainsToolboxScriptDirectories(
        'win32',
        'C:\\Users\\dev',
        'C:\\Users\\dev\\AppData\\Local'
      )
    ).toEqual([WINDOWS_SCRIPTS])
  })

  it('offers nothing on Windows without LOCALAPPDATA rather than guessing a path', () => {
    expect(getJetBrainsToolboxScriptDirectories('win32', 'C:\\Users\\dev', null)).toEqual([])
  })
})

describe('resolveJetBrainsToolboxScript', () => {
  it('finds the launcher Toolbox generated on macOS', () => {
    expect(
      resolveJetBrainsToolboxScript('goland', {
        platform: 'darwin',
        homePath: '/Users/dev',
        fileExists: existsOnly(`${MAC_SCRIPTS}/goland`)
      })
    ).toBe(`${MAC_SCRIPTS}/goland`)
  })

  it('prefers the .cmd shim on Windows', () => {
    expect(
      resolveJetBrainsToolboxScript('goland', {
        platform: 'win32',
        homePath: 'C:\\Users\\dev',
        localAppData: 'C:\\Users\\dev\\AppData\\Local',
        fileExists: existsOnly(`${WINDOWS_SCRIPTS}\\goland.cmd`, `${WINDOWS_SCRIPTS}\\goland`)
      })
    ).toBe(`${WINDOWS_SCRIPTS}\\goland.cmd`)
  })

  it('returns null when Toolbox generated no launcher for that IDE', () => {
    expect(
      resolveJetBrainsToolboxScript('rider', {
        platform: 'darwin',
        homePath: '/Users/dev',
        fileExists: existsOnly(`${MAC_SCRIPTS}/goland`)
      })
    ).toBeNull()
  })

  it('refuses a value that is already a path', () => {
    // Why: the caller resolves explicit paths directly, and joining one under the scripts
    // directory would invent a location that does not exist.
    expect(
      resolveJetBrainsToolboxScript('/opt/goland/bin/goland.sh', {
        platform: 'darwin',
        homePath: '/Users/dev',
        fileExists: () => true
      })
    ).toBeNull()
  })

  it('refuses a blank command', () => {
    expect(
      resolveJetBrainsToolboxScript('   ', {
        platform: 'darwin',
        homePath: '/Users/dev',
        fileExists: () => true
      })
    ).toBeNull()
  })
})
