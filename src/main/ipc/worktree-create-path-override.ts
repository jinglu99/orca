import { relativePathInsideRoot, resolveRuntimePath } from '../../shared/cross-platform-path'

/**
 * Resolves an explicit create-time worktree path, confined to the workspace root that would
 * otherwise own the derived path.
 *
 * Why confined rather than trusted: the override crosses an IPC boundary, so a crafted value
 * must never place a worktree — and therefore a later `worktree remove` — outside the workspace
 * root. `..` is collapsed first because the comparison keys in cross-platform-path fold
 * separators and case but leave dot segments intact, so `<root>/../etc` would otherwise pass a
 * raw prefix test.
 *
 * Cross-platform by construction: the root may be a POSIX path on an SSH host, a Windows path,
 * or a WSL UNC path, so neither side may go through `node:path`.
 */
export function resolveWorktreeCreatePathOverride(
  overridePath: string,
  workspaceRoot: string
): string {
  const requested = overridePath.trim()
  if (!requested) {
    throw new Error('Worktree path override must not be empty.')
  }
  const resolved = resolveRuntimePath(workspaceRoot, requested)
  const relative = relativePathInsideRoot(workspaceRoot, resolved)
  // Why `''` is rejected too: that is the root itself, and a worktree may never be the root.
  if (relative === null || relative === '') {
    throw new Error(
      `Worktree path override "${requested}" must resolve to a location inside "${workspaceRoot}".`
    )
  }
  return resolved
}
