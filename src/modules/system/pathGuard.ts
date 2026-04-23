import path from "node:path";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";

const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

/**
 * Resolves a project folder name under `workspace/projects/<name>` and enforces workspace containment.
 */
export function resolveProjectInWorkspace(ws: WorkspaceManager, projectName: string): string {
  const name = projectName.trim();
  if (!SAFE_NAME.test(name)) {
    throw new Error(`Invalid project name: ${projectName}`);
  }
  const root = path.join(ws.projectsDir(), name);
  ws.assertPathInWorkspace(root);
  return root;
}

export function resolvePathInWorkspace(ws: WorkspaceManager, absoluteOrRelativeFromWorkspace: string): string {
  const abs = path.isAbsolute(absoluteOrRelativeFromWorkspace)
    ? path.resolve(absoluteOrRelativeFromWorkspace)
    : path.resolve(ws.root, absoluteOrRelativeFromWorkspace);
  ws.assertPathInWorkspace(abs);
  return abs;
}

/**
 * Validates an absolute path is inside one of configured desktop allowlist roots.
 */
export function assertPathInDesktopAllowlist(cfg: RuntimeConfig, absoluteTarget: string): void {
  const target = path.resolve(absoluteTarget);
  const ok = cfg.desktopAllowedPaths.some((rootRaw) => {
    const root = path.resolve(rootRaw);
    const rel = path.relative(root, target);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  if (!ok) {
    throw new Error(`Path outside DESKTOP_ALLOWED_PATHS: ${target}`);
  }
}
