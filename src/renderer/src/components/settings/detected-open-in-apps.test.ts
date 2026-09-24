import { describe, expect, it } from 'vitest'
import { getUnaddedDetectedApps } from './DetectedOpenInApps'

const detected = [
  { command: 'goland', label: 'GoLand', source: 'jetbrains-toolbox' as const },
  { command: 'code', label: 'VS Code', source: 'path' as const }
]

describe('getUnaddedDetectedApps', () => {
  it('offers everything when nothing is configured yet', () => {
    expect(getUnaddedDetectedApps(detected, []).map((app) => app.command)).toEqual([
      'goland',
      'code'
    ])
  })

  it('hides an app once it has been added', () => {
    expect(
      getUnaddedDetectedApps(detected, [{ command: 'code' }]).map((app) => app.command)
    ).toEqual(['goland'])
  })

  it('matches regardless of case and padding in the stored command', () => {
    // Why: the command is a free-text field, so a user-typed "  GoLand " must still count as added
    // or the menu would offer a duplicate.
    expect(
      getUnaddedDetectedApps(detected, [{ command: '  GoLand ' }]).map((a) => a.command)
    ).toEqual(['code'])
  })

  it('returns nothing when every detected app is configured', () => {
    expect(getUnaddedDetectedApps(detected, [{ command: 'goland' }, { command: 'code' }])).toEqual(
      []
    )
  })
})
