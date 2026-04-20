import path from "node:path";
import fs from "node:fs/promises";
import { readJsonFile } from "../fs/async.js";
import type { RawTaskJson } from "../types/task.js";

export interface RegisteredTask {
  id: string;
  title: string;
  filePath: string;
}

/**
 * Discovers `*.json` tasks under `dir` and indexes them by `id` from the JSON body.
 */
export class TaskRegistry {
  private readonly byId = new Map<string, RegisteredTask>();

  private constructor(public readonly tasksDir: string) {}

  static async load(tasksDir: string): Promise<TaskRegistry> {
    const reg = new TaskRegistry(path.resolve(tasksDir));
    await reg.refresh();
    return reg;
  }

  async refresh(): Promise<void> {
    this.byId.clear();
    let entries;
    try {
      entries = await fs.readdir(this.tasksDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith(".json")) continue;
      const filePath = path.join(this.tasksDir, ent.name);
      try {
        const raw = await readJsonFile<RawTaskJson>(filePath);
        if (!raw?.id) continue;
        this.byId.set(raw.id, { id: raw.id, title: raw.title ?? "(no title)", filePath });
      } catch {
        // skip invalid files
      }
    }
  }

  list(): RegisteredTask[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  findById(id: string): RegisteredTask | undefined {
    return this.byId.get(id);
  }
}

export function resolveTasksDir(cwd: string): string {
  const fromEnv = process.env.TASKS_DIR?.trim();
  if (fromEnv) return path.resolve(cwd, fromEnv);
  return path.resolve(cwd, "samples", "tasks");
}
