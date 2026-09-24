import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  claimGroupWorkspaceContainerDirectory,
  removeGroupWorkspaceContainerDirectory
} from './group-workspace-container-directory'

const deps = { getSshFilesystemProvider: () => undefined }
const roots: string[] = []

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-group-container-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('group workspace container directory on a real filesystem', () => {
  it('claims a container and refuses to adopt an existing one', async () => {
    const root = await makeRoot()
    const containerPath = join(root, 'workspaces', 'platform', 'login')

    await claimGroupWorkspaceContainerDirectory({ containerPath }, deps)
    expect(existsSync(containerPath)).toBe(true)

    await expect(claimGroupWorkspaceContainerDirectory({ containerPath }, deps)).rejects.toThrow(
      /folder_workspace_container_exists/
    )
  })

  it('removes the container without following symlinks out of it', async () => {
    // Why this test exists: the container shares the group root's docs and instructions by
    // symlink, so a delete that recursed through them would take the user's real source with it.
    const root = await makeRoot()
    const groupRoot = join(root, 'platform')
    const sharedDocs = join(groupRoot, 'docs')
    await mkdir(sharedDocs, { recursive: true })
    await writeFile(join(sharedDocs, 'architecture.md'), '# shared\n')
    await writeFile(join(groupRoot, 'AGENTS.md'), '# group brief\n')

    const containerPath = join(root, 'workspaces', 'platform', 'login')
    await claimGroupWorkspaceContainerDirectory({ containerPath }, deps)
    await symlink(sharedDocs, join(containerPath, 'docs'))
    await symlink(join(groupRoot, 'AGENTS.md'), join(containerPath, 'AGENTS.md'))
    await mkdir(join(containerPath, 'api'), { recursive: true })
    await writeFile(join(containerPath, 'api', 'main.go'), 'package main\n')

    await removeGroupWorkspaceContainerDirectory({ containerPath }, deps)

    expect(existsSync(containerPath)).toBe(false)
    expect(existsSync(sharedDocs)).toBe(true)
    expect(await readdir(sharedDocs)).toEqual(['architecture.md'])
    expect(existsSync(join(groupRoot, 'AGENTS.md'))).toBe(true)
  })

  it('treats an already-missing container as removed', async () => {
    const root = await makeRoot()
    await expect(
      removeGroupWorkspaceContainerDirectory({ containerPath: join(root, 'gone') }, deps)
    ).resolves.toBeUndefined()
  })
})
