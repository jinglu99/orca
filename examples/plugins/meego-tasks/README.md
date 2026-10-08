# Meego Tasks

Adds a **Meego** source to Orca's Tasks page: the needs (需求) you participate in, split into
进行中需求 and 全部需求, a detail preview (status, current nodes, roles, PRD links), and
"Start workspace" from any item. The workspace is named after the Meego title.

## Requirements

- `bytedcli` on `PATH` (or at `~/.local/bin/bytedcli`) and logged in: `bytedcli meego login`.
  Check with `bytedcli meego status --json`.
- Optional: pin the space for the need views with `bytedcli meego config --space <空间>` (name,
  simple name, or project key). Without it, the plugin uses the spaces your todos are in (up to 3).

## Install

1. Settings → Plugins → turn on the plugin system.
2. Either **Install plugin** → **Local folder** with this directory, or **Development** →
   **Add path** to load it in place with hot reload.
3. **Review & enable** it. The consent dialog notes that the worker runs with full local access:
   it executes `bytedcli` as you.
4. Open Tasks and pick the Meego (flag) source.

## How it works

The plugin contributes a `taskProviders` entry (see `orca-plugin.json`) naming two worker
commands:

- `meego.list` runs `bytedcli meego workitem list` with MQL: needs (`story`) whose participants
  include the current user, newest first, with status, priority, owners, and in-progress nodes
  in one query (up to 200 per space). 进行中需求 hides statuses that read as finished
  (完成 / 关闭 / 终止). The space config is re-read on every refresh.
- `meego.detail` runs `bytedcli meego workitem get` for the preview.

MQL is passed to bytedcli as a `-P @file` params file, never as a command-line argument.
