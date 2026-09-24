import { getRuntimePathBasename, resolveRuntimePath } from './cross-platform-path'

export type GroupWorkspaceMemberRepo = {
  id: string
  path: string
}

export type GroupWorkspaceMemberPlacement = {
  repoId: string
  /** Directory name under the container. Unique across the member set. */
  segment: string
  path: string
}

/**
 * Where each member repo's worktree sits inside a group workspace container.
 *
 * Why the whole set is planned at once rather than one repo at a time: a group can legitimately
 * hold two repos whose directories share a name (`web/api` and `mobile/api`), and a per-repo
 * function would hand both the same container subdirectory. The second one is suffixed instead,
 * so a member always has a directory of its own.
 */
export function planGroupWorkspaceMemberPaths(
  containerPath: string,
  repos: readonly GroupWorkspaceMemberRepo[]
): GroupWorkspaceMemberPlacement[] {
  const usedSegments = new Set<string>()
  return repos.map((repo) => {
    const segment = claimMemberSegment(memberSegmentSeed(repo.path), usedSegments)
    return { repoId: repo.id, segment, path: resolveRuntimePath(containerPath, segment) }
  })
}

function memberSegmentSeed(repoPath: string): string {
  const basename = getRuntimePathBasename(repoPath).replace(/\.git$/, '')
  // Why a fallback: a repo registered at a filesystem root has no basename to borrow, and an
  // empty segment would resolve to the container itself.
  return basename.trim() || 'repo'
}

function claimMemberSegment(seed: string, usedSegments: Set<string>): string {
  if (!usedSegments.has(seed)) {
    usedSegments.add(seed)
    return seed
  }
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${seed}-${suffix}`
    if (!usedSegments.has(candidate)) {
      usedSegments.add(candidate)
      return candidate
    }
  }
}
