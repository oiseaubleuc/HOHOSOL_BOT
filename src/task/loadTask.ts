import path from "node:path";
import { readJsonFile } from "../fs/async.js";
import type { RawTaskJson, TaskSpec } from "../types/task.js";

export async function loadTaskFromFile(taskPath: string): Promise<TaskSpec> {
  const abs = path.resolve(taskPath);
  const raw = await readJsonFile<RawTaskJson>(abs);
  const rootField = raw.projectRoot ?? raw.projectPath;
  if (!raw.id || !raw.title || !raw.description || !rootField) {
    throw new Error(`Invalid task JSON at ${abs}: id, title, description, projectRoot (or projectPath) are required`);
  }
  const projectRoot = path.resolve(path.dirname(abs), rootField);
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    projectRoot,
    priority: raw.priority,
    acceptanceCriteria: raw.acceptanceCriteria,
    fileHints: raw.fileHints,
    labels: raw.labels,
  };
}
