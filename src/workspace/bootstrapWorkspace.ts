import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceManager } from "./workspaceManager.js";

/** When `false`, empty `tasks/` stays empty (no copy from `samples/tasks`). Default: seed samples. */
export function isSampleTaskSeedingEnabled(): boolean {
  const v = process.env.DEVBOT_SEED_SAMPLE_TASKS?.trim().toLowerCase();
  if (!v) return true;
  return !["0", "false", "no", "off"].includes(v);
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Seeds `workspace/tasks` from `samples/tasks` when empty (dev convenience).
 */
export async function bootstrapWorkspaceTasksIfEmpty(ws: WorkspaceManager, repoRoot: string): Promise<void> {
  await ws.ensureLayout();
  if (!isSampleTaskSeedingEnabled()) return;
  const existing = await fs.readdir(ws.tasksDir()).catch(() => []);
  const jsonCount = existing.filter((f) => f.endsWith(".json")).length;
  if (jsonCount > 0) return;

  const sampleDir = path.join(repoRoot, "samples", "tasks");
  let names: string[];
  try {
    names = await fs.readdir(sampleDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const src = path.join(sampleDir, name);
    const dest = path.join(ws.tasksDir(), name);
    await fs.copyFile(src, dest);
  }
}

/**
 * Copies fixture projects into `workspace/projects/*` and rewrites task JSON roots to stay inside the workspace.
 */
export async function bootstrapDefaultWorkspaceContent(ws: WorkspaceManager, repoRoot: string): Promise<void> {
  await ws.ensureLayout();
  await bootstrapWorkspaceTasksIfEmpty(ws, repoRoot);

  const laravelSrc = path.join(repoRoot, "samples", "fixtures", "sample-laravel");
  const laravelDest = path.join(ws.projectsDir(), "sample-laravel");
  if ((await pathExists(laravelSrc)) && !(await pathExists(laravelDest))) {
    await fs.cp(laravelSrc, laravelDest, { recursive: true });
  }

  const nodeSrc = path.join(repoRoot, "samples", "fixtures", "sample-node");
  const nodeDest = path.join(ws.projectsDir(), "sample-node");
  if ((await pathExists(nodeSrc)) && !(await pathExists(nodeDest))) {
    await fs.cp(nodeSrc, nodeDest, { recursive: true });
  }

  const taskFiles = await fs.readdir(ws.tasksDir()).catch(() => []);
  for (const name of taskFiles) {
    if (!name.endsWith(".json")) continue;
    const p = path.join(ws.tasksDir(), name);
    let raw = await fs.readFile(p, "utf8");
    const before = raw;
    raw = raw.replaceAll('"../fixtures/sample-laravel"', '"../projects/sample-laravel"');
    raw = raw.replaceAll('"../fixtures/sample-node"', '"../projects/sample-node"');
    if (raw !== before) await fs.writeFile(p, raw, "utf8");
  }
}
