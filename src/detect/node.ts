import path from "node:path";
import { pathExists, readJsonFile } from "../fs/async.js";
import type { NodeLayout } from "../types/project.js";

interface PackageJson {
  name?: string;
  type?: string;
  main?: string;
  scripts?: Record<string, string>;
}

export async function isNodeProject(root: string): Promise<boolean> {
  return pathExists(path.join(root, "package.json"));
}

export async function resolveNodeLayout(root: string): Promise<NodeLayout> {
  const packageJsonPath = path.join(root, "package.json");
  const pkg = await readJsonFile<PackageJson>(packageJsonPath);
  let lockfile: NodeLayout["lockfile"] = "none";
  if (await pathExists(path.join(root, "pnpm-lock.yaml"))) lockfile = "pnpm";
  else if (await pathExists(path.join(root, "yarn.lock"))) lockfile = "yarn";
  else if (await pathExists(path.join(root, "package-lock.json"))) lockfile = "npm";

  const entryHints: string[] = [];
  if (pkg.main) entryHints.push(path.join(root, pkg.main));
  for (const cand of ["src/index.ts", "src/main.ts", "src/server.ts", "index.js", "server.js"]) {
    const p = path.join(root, cand);
    if (await pathExists(p)) entryHints.push(p);
  }
  return { packageJsonPath, lockfile, entryHints };
}
