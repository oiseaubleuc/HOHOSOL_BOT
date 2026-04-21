import path from "node:path";
import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../../system/pathGuard.js";
import { runSafeArgv } from "../../system/safeRunner.js";
import type { ActionResult } from "../types.js";
import { devCommandsForStack, summarizeStack } from "../stackDetect.js";

export async function runInstall(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const cmds = devCommandsForStack(s);
  if (!cmds.install.length) {
    return { success: false, actionType: "INSTALL_DEPENDENCIES", summary: "No package manager detected", error: "none" };
  }
  const r = await runSafeArgv(ws, root, cmds.install);
  return {
    success: r.exitCode === 0,
    actionType: "INSTALL_DEPENDENCIES",
    summary: `install (${cmds.install.join(" ")})`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function runBuild(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const cmds = devCommandsForStack(s);
  if (!cmds.build) {
    return { success: false, actionType: "RUN_BUILD", summary: "No build script", error: "missing" };
  }
  const r = await runSafeArgv(ws, root, cmds.build);
  return {
    success: r.exitCode === 0,
    actionType: "RUN_BUILD",
    summary: `build`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function runTests(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const cmds = devCommandsForStack(s);
  if (!cmds.test) {
    return { success: false, actionType: "RUN_TESTS", summary: "No test script", error: "missing" };
  }
  const r = await runSafeArgv(ws, root, cmds.test);
  return {
    success: r.exitCode === 0,
    actionType: "RUN_TESTS",
    summary: `test`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function runLint(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const cmds = devCommandsForStack(s);
  if (!cmds.lint) {
    return { success: false, actionType: "RUN_LINT", summary: "No lint script", error: "missing" };
  }
  const r = await runSafeArgv(ws, root, cmds.lint);
  return {
    success: r.exitCode === 0,
    actionType: "RUN_LINT",
    summary: `lint`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}

export async function runArtisanSafe(ws: WorkspaceManager, projectName: string, argvTail: string[]): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const artisanPath = path.join(root, "artisan");
  const argv = ["php", artisanPath, ...argvTail];
  const r = await runSafeArgv(ws, root, argv);
  return {
    success: r.exitCode === 0,
    actionType: "RUN_TESTS",
    summary: `php artisan ${argvTail.join(" ")}`,
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
    error: r.exitCode === 0 ? undefined : `exit ${r.exitCode}`,
  };
}
