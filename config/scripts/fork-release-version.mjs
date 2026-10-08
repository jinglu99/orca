import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const CORE_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/

function parseCore(version) {
  const match = CORE_RE.exec(version)
  return match ? match.slice(1, 4).map(Number) : null
}

function compareCore(left, right) {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

/**
 * Next fork release version: one patch above the larger of package.json and every published tag.
 * Why tags, not a committed bump: the version never has to be pushed back to main, and an
 * upstream merge that raises package.json is picked up without ever going backwards.
 */
export function nextForkReleaseVersion(packageVersion, tags) {
  let base = parseCore(packageVersion)
  if (!base) {
    throw new Error(`Package version is not valid semver: ${packageVersion}`)
  }
  for (const tag of tags) {
    const core = parseCore(tag)
    if (core && compareCore(core, base) > 0) {
      base = core
    }
  }
  return `${base[0]}.${base[1]}.${base[2] + 1}`
}

function listRemoteTags(remote) {
  const output = execFileSync('git', ['ls-remote', '--tags', '--refs', remote], {
    encoding: 'utf8'
  })
  return output
    .split('\n')
    .map((line) => line.split('refs/tags/')[1])
    .filter(Boolean)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const remote = process.argv[2] ?? 'origin'
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  console.log(nextForkReleaseVersion(packageJson.version, listRemoteTags(remote)))
}
