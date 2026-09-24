import { getRuntimePathBasename, relativePathInsideRoot } from './cross-platform-path'

/**
 * Entries a coding agent reads from the directory it is started in.
 *
 * A group workspace's container is a directory the agent has never seen, so without these it
 * starts with no brief at all — the group root's instructions describe how the member repos relate,
 * which is exactly what a cross-repo task needs.
 */
export const GROUP_WORKSPACE_AGENT_CONTEXT_ENTRIES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.claude',
  '.cursor',
  '.mcp.json'
] as const

export type GroupWorkspaceLinkPlanInput = {
  /** Entry names present directly under the group root. */
  groupRootEntries: readonly string[]
  /** Absolute paths of git repos that get their own worktree. Never linked. */
  memberRepoPaths: readonly string[]
  /** Absolute paths of non-git projects registered in the group. */
  folderProjectPaths: readonly string[]
  groupParentPath: string
}

/**
 * The group-root entries a new container shares back to, as paths relative to the group root.
 *
 * Why registration is the filter for directories rather than "everything that is not a repo": a
 * group root also holds `tmp`, `log`, downloaded archives and `.DS_Store`, and linking those would
 * make every workspace carry the user's scratch. Having added a folder to the group in Orca is the
 * only statement of intent available, so that is what counts.
 */
export function planGroupWorkspaceLinkedPaths(input: GroupWorkspaceLinkPlanInput): string[] {
  const memberRepoNames = new Set(
    input.memberRepoPaths
      .map((repoPath) => relativePathInsideRoot(input.groupParentPath, repoPath))
      .filter((relative): relative is string => Boolean(relative))
  )
  const planned: string[] = []
  const seen = new Set<string>()
  const add = (entry: string): void => {
    // Why member repos are excluded rather than deduped: a worktree already occupies that name in
    // the container, and linking the source checkout over it would replace the isolated copy.
    if (!entry || seen.has(entry) || memberRepoNames.has(entry)) {
      return
    }
    seen.add(entry)
    planned.push(entry)
  }

  const rootEntries = new Set(input.groupRootEntries)
  for (const entry of GROUP_WORKSPACE_AGENT_CONTEXT_ENTRIES) {
    if (rootEntries.has(entry)) {
      add(entry)
    }
  }
  for (const folderPath of input.folderProjectPaths) {
    const relative = relativePathInsideRoot(input.groupParentPath, folderPath)
    // Why only direct children: a registered folder nested deeper belongs to some other tree, and
    // recreating that tree inside the container would imply a structure the group does not have.
    if (relative && relative === getRuntimePathBasename(folderPath)) {
      add(relative)
    }
  }
  return planned
}
