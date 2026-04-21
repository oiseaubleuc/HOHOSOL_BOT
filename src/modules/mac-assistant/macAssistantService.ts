import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import { openFinder, openIdeOrApp, openAppOnly } from "../developer-control/adapters/macOpenAdapter.js";
import type { ActionResult } from "../developer-control/types.js";

/**
 * Safe macOS-local surface: IDE/Finder launches only inside validated workspace paths.
 */
export class MacAssistantService {
  constructor(private readonly ws: WorkspaceManager) {}

  async openCursor(project?: string): Promise<ActionResult> {
    return openIdeOrApp(this.ws, "cursor", project);
  }

  async openVsCode(project?: string): Promise<ActionResult> {
    return openIdeOrApp(this.ws, "vscode", project);
  }

  async openFinder(project?: string): Promise<ActionResult> {
    return openFinder(this.ws, project);
  }

  async openBrave(): Promise<ActionResult> {
    return openAppOnly(this.ws, "brave");
  }
}
