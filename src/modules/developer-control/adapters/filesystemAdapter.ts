import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceManager } from "../../../workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../../system/pathGuard.js";
import type { ActionResult } from "../types.js";

function assertSafeRelative(rel: string): void {
  const n = path.normalize(rel);
  if (n.startsWith("..") || path.isAbsolute(n)) {
    throw new Error("Path must be relative without traversal");
  }
}

export async function listProjectFiles(ws: WorkspaceManager, projectName: string, max = 80): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const lines = entries.slice(0, max).map((e) => `${e.isDirectory() ? "d" : "-"} ${e.name}`);
  return {
    success: true,
    actionType: "LIST_FILES",
    summary: `Listed ${lines.length} entries in ${projectName}`,
    output: lines.join("\n"),
  };
}

export async function treeProjectShallow(ws: WorkspaceManager, projectName: string): Promise<ActionResult> {
  const root = resolveProjectInWorkspace(ws, projectName);
  const out: string[] = [];
  async function walk(dir: string, depth: number, prefix: string): Promise<void> {
    if (depth > 2 || out.length > 120) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries.slice(0, 40)) {
      out.push(`${prefix}${e.name}${e.isDirectory() ? "/" : ""}`);
      if (e.isDirectory()) {
        await walk(path.join(dir, e.name), depth + 1, `${prefix}  `);
      }
    }
  }
  await walk(root, 0, "");
  return {
    success: true,
    actionType: "LIST_FILES",
    summary: `Tree (depth≤2) for ${projectName}`,
    output: out.join("\n").slice(0, 3500),
  };
}

export async function readProjectFile(ws: WorkspaceManager, projectName: string, rel: string): Promise<ActionResult> {
  assertSafeRelative(rel);
  const root = resolveProjectInWorkspace(ws, projectName);
  const file = path.join(root, rel);
  ws.assertPathInWorkspace(file);
  const raw = await fs.readFile(file, "utf8");
  return {
    success: true,
    actionType: "READ_FILE",
    summary: `Read ${rel}`,
    output: raw.slice(0, 4000),
  };
}
