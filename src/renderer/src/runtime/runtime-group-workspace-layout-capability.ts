import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import {
  GROUP_WORKSPACE_LAYOUT_RUNTIME_CAPABILITY,
  GROUP_WORKSPACE_LAYOUT_UPDATE_REQUIRED_MESSAGE
} from '../../../shared/folder-workspace-runtime-capabilities'
import { assertRuntimeEnvironmentCapability, type RuntimeClientTarget } from './runtime-rpc-client'

export async function assertGroupWorkspaceLayoutCapability(
  target: RuntimeClientTarget,
  args: { layout?: FolderWorkspace['layout'] }
): Promise<void> {
  // Why negotiated rather than sent hopefully: an older host drops `layout` and returns a
  // shared-parent workspace, and the member creates that follow would then scatter across
  // per-repo directories with nothing to tell the user the grouping did not happen.
  if (target.kind === 'environment' && args.layout === 'isolated-container') {
    await assertRuntimeEnvironmentCapability(
      target.environmentId,
      GROUP_WORKSPACE_LAYOUT_RUNTIME_CAPABILITY,
      GROUP_WORKSPACE_LAYOUT_UPDATE_REQUIRED_MESSAGE
    )
  }
}
