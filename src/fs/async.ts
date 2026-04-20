import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function listFilesRecursive(
  root: string,
  options: { maxFiles: number; ignore: (rel: string) => boolean },
): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (out.length >= options.maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (out.length >= options.maxFiles) return;
      const full = path.join(dir, ent.name);
      const rel = path.relative(root, full);
      if (options.ignore(rel)) continue;
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }

  await walk(root);
  return out;
}
