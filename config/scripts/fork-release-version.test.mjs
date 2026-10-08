import { describe, expect, it } from 'vitest'
import { nextForkReleaseVersion } from './fork-release-version.mjs'

describe('nextForkReleaseVersion', () => {
  it('bumps the patch above package.json when nothing newer is published', () => {
    expect(nextForkReleaseVersion('1.4.197', [])).toBe('1.4.198')
  })

  it('continues from the newest published tag, including legacy local builds', () => {
    expect(
      nextForkReleaseVersion('1.4.197', [
        'main-build-2-1c851ef74ed0',
        'v1.4.197-local.1791445464068.707762676871',
        'v1.4.205',
        'v1.4.199'
      ])
    ).toBe('1.4.206')
    // A prerelease of 1.4.197 sorts below 1.4.197, so the next stable must still be above it.
    expect(nextForkReleaseVersion('1.4.197', ['v1.4.197-local.1.abc'])).toBe('1.4.198')
  })

  it('follows an upstream merge that raises package.json past the fork tags', () => {
    expect(nextForkReleaseVersion('1.4.214', ['v1.4.205'])).toBe('1.4.215')
  })

  it('restarts the patch after a manual minor bump', () => {
    expect(nextForkReleaseVersion('1.5.0', ['v1.4.230'])).toBe('1.5.1')
  })

  it('rejects a non-semver package version', () => {
    expect(() => nextForkReleaseVersion('next', [])).toThrow('not valid semver')
  })
})
