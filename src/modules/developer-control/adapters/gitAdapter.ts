import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../../system/pathGuard.js";
import { runSafeArgv } from "../../system/safeRunner.js";
import type { ActionResult } from "../types.js";

export async function gitStatus(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const r = await runSafeArgv(ws, root, ["git", "status", "-sb"]);
  return {
    success: r.exitCode === 0,
    actionType: "GIT_STATUS",
    summary: `git status (${projectName})`,
    output: `${r.stdout}\n${r.stderr}`.trim(),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function gitDiff(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const r = await runSafeArgv(ws, root, ["git", "diff", "--stat"]);
  return {
    success: r.exitCode === 0,
    actionType: "GIT_STATUS",
    summary: `git diff --stat (${projectName})`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
  };
}

export async function gitCreateBranch(ws: WorkspaceManager, projectName: string, branch: string): Promise<ActionResult> {
  if (!/^[a-zA-Z0-9._/-]{1,120}$/.test(branch)) {
    return { success: false, actionType: "GIT_CREATE_BRANCH", summary: "Invalid branch name", error: branch };
  }
  const root = resolveProjectInWorkspace(ws, projectName);
  const r = await runSafeArgv(ws, root, ["git", "checkout", "-b", branch]);
  return {
    success: r.exitCode === 0,
    actionType: "GIT_CREATE_BRANCH",
    summary: `Created branch ${branch}`,
    output: `${r.stdout}\n${r.stderr}`.trim(),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function gitCommit(ws: WorkspaceManager, projectName: string, message: string): Promise<ActionResult> {
  if (!message.trim() || message.length > 500) {
    return { success: false, actionType: "GIT_COMMIT", summary: "Invalid commit message", error: "message" };
  }
  const root = resolveProjectInWorkspace(ws, projectName);
  const r = await runSafeArgv(ws, root, ["git", "commit", "-am", message]);
  return {
    success: r.exitCode === 0,
    actionType: "GIT_COMMIT",
    summary: `git commit (${projectName})`,
    output: `${r.stdout}\n${r.stderr}`.trim(),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}
