import path from "node:path";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import { assertPathInDesktopAllowlist, resolveProjectInWorkspace, resolvePathInWorkspace } from "./pathGuard.js";

export function resolveApprovedPath(
  ws: WorkspaceManager,
  cfg: RuntimeConfig,
  input: { workspaceRelative?: string; projectName?: string; desktopAbsolute?: string },
): string {
  if (input.projectName) return resolveProjectInWorkspace(ws, input.projectName);
  if (input.workspaceRelative) return resolvePathInWorkspace(ws, input.workspaceRelative);
  if (input.desktopAbsolute) {
    const abs = path.resolve(input.desktopAbsolute);
    assertPathInDesktopAllowlist(cfg, abs);
    return abs;
  }
  throw new Error("No path input provided");
}

