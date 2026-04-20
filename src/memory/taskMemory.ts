import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceManager } from "../workspace/workspaceManager.js";

export interface TaskMemoryRecord {
  taskId: string;
  updatedAt: string;
  timeline: Array<{ at: string; phase: string; note: string }>;
  lastError?: string;
  suggestions?: string[];
}

export async function readTaskMemory(ws: WorkspaceManager, taskId: string): Promise<TaskMemoryRecord | undefined> {
  const dir = path.join(ws.stateDir(), "memory");
  const p = path.join(dir, `${taskId.replace(/[^a-zA-Z0-9._-]+/g, "_")}.json`);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as TaskMemoryRecord;
  } catch {
    return undefined;
  }
}

export async function appendTaskMemory(
  ws: WorkspaceManager,
  taskId: string,
  entry: { phase: string; note: string },
  patch?: Partial<Pick<TaskMemoryRecord, "lastError" | "suggestions">>,
): Promise<void> {
  const dir = path.join(ws.stateDir(), "memory");
  await fs.mkdir(dir, { recursive: true });
  const p = path.join(dir, `${taskId.replace(/[^a-zA-Z0-9._-]+/g, "_")}.json`);
  const prev = (await readTaskMemory(ws, taskId)) ?? {
    taskId,
    updatedAt: new Date().toISOString(),
    timeline: [],
  };
  const next: TaskMemoryRecord = {
    ...prev,
    ...patch,
    taskId,
    updatedAt: new Date().toISOString(),
    timeline: [...prev.timeline, { at: new Date().toISOString(), phase: entry.phase, note: entry.note }],
  };
  await fs.writeFile(p, JSON.stringify(next, null, 2), "utf8");
}
