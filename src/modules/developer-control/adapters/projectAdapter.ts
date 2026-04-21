import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { inspectProject } from "../inspectProject.js";

export { resolveProjectInWorkspace } from "../../system/pathGuard.js";

export async function inspectWorkspaceProject(ws: WorkspaceManager, projectName: string) {
  return inspectProject(ws, projectName);
}
