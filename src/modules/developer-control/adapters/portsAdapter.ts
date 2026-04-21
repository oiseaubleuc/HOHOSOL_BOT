import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { runSafeArgv } from "../../system/safeRunner.js";
import type { ActionResult } from "../types.js";

export async function listListeningPorts(ws: WorkspaceManager): Promise<ActionResult> {
  const r = await runSafeArgv(ws, ws.root, ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]);
  return {
    success: true,
    actionType: "LIST_PORTS",
    summary: "Listening TCP ports (truncated)",
    output: `${r.stdout}\n${r.stderr}`.trim().slice(0, 3500),
  };
}

export async function listProcesses(ws: WorkspaceManager): Promise<ActionResult> {
  const r = await runSafeArgv(ws, ws.root, ["ps", "-ax", "-o", "pid=,comm="]);
  const lines = `${r.stdout}`.split("\n").filter(Boolean).slice(0, 40);
  return {
    success: true,
    actionType: "LIST_PROCESSES",
    summary: "Top processes snapshot",
    output: lines.join("\n"),
  };
}

export async function killPort(ws: WorkspaceManager, port: number): Promise<ActionResult> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { success: false, actionType: "KILL_PORT", summary: "Invalid port", error: String(port) };
  }
  const r = await runSafeArgv(ws, ws.root, ["lsof", "-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  const pids = `${r.stdout}`
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^\d+$/.test(s));
  if (pids.length === 0) {
    return { success: true, actionType: "KILL_PORT", summary: `No listener on ${port}`, output: "" };
  }
  const kills: string[] = [];
  for (const pid of pids) {
    const k = await runSafeArgv(ws, ws.root, ["kill", "-TERM", pid]);
    kills.push(`pid ${pid} exit=${k.exitCode}`);
  }
  return {
    success: true,
    actionType: "KILL_PORT",
    summary: `Sent SIGTERM to listener(s) on ${port}`,
    output: kills.join("\n"),
  };
}
