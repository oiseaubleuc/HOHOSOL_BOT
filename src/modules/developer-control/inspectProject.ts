import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../system/pathGuard.js";
import type { ActionResult } from "./types.js";
import { summarizeStack } from "./stackDetect.js";

export async function inspectProject(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const lines = [
    `project: ${projectName}`,
    `root: ${root}`,
    `stack: ${s.kind}`,
    `packageManager: ${s.packageManager}`,
    `typescript: ${s.hasTypeScript}`,
    `scripts: ${Object.keys(s.scripts).slice(0, 12).join(", ") || "(none)"}`,
  ];
  return {
    success: true,
    actionType: "INSPECT_PROJECT",
    summary: `Inspect ${projectName}`,
    output: lines.join("\n"),
  };
}
