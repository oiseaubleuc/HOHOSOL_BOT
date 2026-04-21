import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import type { ActionType, ActionResult } from "./types.js";
import { policyForAction } from "./policy.js";
import { createDevActionId, enqueueDevAction } from "./actionQueue.js";

export async function gateAndRun(
  cfg: RuntimeConfig,
  actionType: ActionType,
  summary: string,
  runner: () => Promise<ActionResult>,
): Promise<ActionResult> {
  const p = policyForAction(actionType);
  if (p === "deny") {
    return { success: false, actionType, summary: "Denied by policy", error: "deny" };
  }
  if (p === "requires_approval" && !cfg.autoApprove) {
    const id = createDevActionId();
    enqueueDevAction({
      id,
      summary,
      createdAt: new Date().toISOString(),
      run: runner,
    });
    return {
      success: true,
      actionType,
      summary: `Pending approval: ${summary}`,
      requiresApproval: true,
      details: `/approve ${id}`,
    };
  }
  return await runner();
}

export function dryRunBlock(cfg: RuntimeConfig, actionType: ActionType, label: string): ActionResult | null {
  if (!cfg.dryRun) return null;
  if (
    actionType === "INSTALL_DEPENDENCIES" ||
    actionType === "RUN_DEV_SERVER" ||
    actionType === "GIT_COMMIT" ||
    actionType === "GIT_PUSH" ||
    actionType === "KILL_PORT"
  ) {
    return {
      success: true,
      actionType,
      summary: `DRY_RUN: skipped ${label}`,
      details: "Set DRY_RUN=false to execute after approval where required.",
    };
  }
  return null;
}
