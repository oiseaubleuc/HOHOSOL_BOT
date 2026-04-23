import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../system/pathGuard.js";
import type { ActionResult } from "./types.js";
import { devCommandsForStack, summarizeStack } from "./stackDetect.js";

export async function inspectProject(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const s = await summarizeStack(root);
  const cmds = devCommandsForStack(s);
  const scriptKeys = Object.keys(s.scripts);
  const topScripts = scriptKeys.slice(0, 10).join(", ") || "—";
  const suggested = [
    cmds.build?.length ? `build: ${cmds.build.join(" ")}` : null,
    cmds.test?.length ? `test: ${cmds.test.join(" ")}` : null,
    cmds.lint?.length ? `lint: ${cmds.lint.join(" ")}` : null,
    cmds.install.length ? `install: ${cmds.install.join(" ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    `📦 ${projectName}`,
    `Stack: ${s.kind} · PM: ${s.packageManager} · TS: ${s.hasTypeScript ? "yes" : "no"}`,
    `Scripts (sample): ${topScripts}`,
    suggested ? `Suggested commands:\n${suggested}` : "",
    `Next (Telegram):`,
    `• /dev build ${projectName}`,
    `• /dev test ${projectName}`,
    `• /open cursor ${projectName}`,
  ].filter(Boolean);

  return {
    success: true,
    actionType: "INSPECT_PROJECT",
    summary: `${projectName} — ${s.kind}, ${s.packageManager}`,
    output: lines.join("\n"),
  };
}
