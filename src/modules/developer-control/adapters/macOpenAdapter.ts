import { spawn } from "node:child_process";
import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../../system/pathGuard.js";
import type { ActionResult } from "../types.js";

function runOpen(argv: string[], cwd: string): Promise<number | null> {
  return new Promise((resolve) => {
    const c = spawn(argv[0]!, argv.slice(1), { cwd, shell: false, stdio: "ignore" });
    c.on("error", () => resolve(null));
    c.on("close", (code) => resolve(code));
  });
}

const APP_NAMES: Record<string, string> = {
  cursor: "Cursor",
  vscode: "Visual Studio Code",
  terminal: "Terminal",
  brave: "Brave Browser",
  safari: "Safari",
};

export async function openIdeOrApp(
  ws: WorkspaceManager,
  key: keyof typeof APP_NAMES,
  projectName?: string,
): Promise<ActionResult> {
  const app = APP_NAMES[key];
  const targetDir = projectName ? resolveProjectInWorkspace(ws, projectName) : ws.root;
  ws.assertPathInWorkspace(targetDir);
  const argv = ["open", "-a", app, targetDir];
  const code = await runOpen(argv, ws.root);
  return {
    success: code === 0,
    actionType: `OPEN_${String(key).toUpperCase()}`,
    summary: `${app} open requested for ${targetDir}`,
    details: `argv=${argv.join(" ")} exit=${code}`,
  };
}

export async function openFinder(ws: WorkspaceManager, projectName?: string): Promise<ActionResult> {
  const targetDir = projectName ? resolveProjectInWorkspace(ws, projectName) : ws.projectsDir();
  ws.assertPathInWorkspace(targetDir);
  const argv = ["open", targetDir];
  const code = await runOpen(argv, ws.root);
  return {
    success: code === 0,
    actionType: "OPEN_FINDER",
    summary: `Finder open for ${targetDir}`,
    details: `exit=${code}`,
  };
}

export async function openBrowserUrl(ws: WorkspaceManager, browser: "brave" | "safari", url: string): Promise<ActionResult> {
  const app = browser === "brave" ? "Brave Browser" : "Safari";
  const argv = ["open", "-a", app, url];
  const code = await runOpen(argv, ws.root);
  return {
    success: code === 0,
    actionType: browser === "brave" ? "OPEN_BRAVE_URL" : "OPEN_SAFARI_URL",
    summary: `${app} → ${url}`,
    details: `exit=${code}`,
  };
}

export async function openAppOnly(ws: WorkspaceManager, key: "brave" | "safari"): Promise<ActionResult> {
  const app = key === "brave" ? "Brave Browser" : "Safari";
  const argv = ["open", "-a", app];
  const code = await runOpen(argv, ws.root);
  return {
    success: code === 0,
    actionType: key === "brave" ? "OPEN_BRAVE" : "OPEN_SAFARI_URL",
    summary: `${app} launched`,
    details: `exit=${code}`,
  };
}
