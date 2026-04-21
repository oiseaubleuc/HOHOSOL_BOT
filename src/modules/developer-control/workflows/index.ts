import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../../config/runtimeConfig.js";
import { inspectProject } from "../inspectProject.js";
import { openIdeOrApp } from "../adapters/macOpenAdapter.js";
import type { ActionResult } from "../types.js";

export async function workflowInspectAndOpen(
  ws: WorkspaceManager,
  _cfg: RuntimeConfig,
  project: string,
  ide: "cursor" | "vscode",
): Promise<ActionResult[]> {
  const a = await inspectProject(ws, project);
  const b = await openIdeOrApp(ws, ide, project);
  return [a, b];
}
