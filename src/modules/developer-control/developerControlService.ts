import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import { inspectProject } from "./inspectProject.js";
import type { ActionResult } from "./types.js";
import { gateAndRun } from "./gate.js";
import { runInstall } from "./adapters/devCommandsAdapter.js";

/**
 * High-level orchestration entry points for non-Telegram callers (local assistant, future HTTP).
 */
export class DeveloperControlService {
  constructor(
    private readonly ws: WorkspaceManager,
    private readonly cfg: RuntimeConfig,
  ) {}

  async inspectProject(projectName: string): Promise<ActionResult> {
    return inspectProject(this.ws, projectName);
  }

  async installDependencies(projectName: string): Promise<ActionResult> {
    return gateAndRun(this.cfg, "INSTALL_DEPENDENCIES", `install ${projectName}`, () => runInstall(this.ws, projectName));
  }
}
