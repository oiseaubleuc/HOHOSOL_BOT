import path from "node:path";
import type { ProjectProfile } from "../types/project.js";
import { isLaravelProject, resolveLaravelLayout } from "./laravel.js";
import { isNodeProject, resolveNodeLayout } from "./node.js";

export async function detectProject(rootArg: string): Promise<{ profile: ProjectProfile }> {
  const root = path.resolve(rootArg);
  const laravel = await isLaravelProject(root);
  const node = await isNodeProject(root);

  const profile: ProjectProfile = { root, flavor: "unknown" };

  if (laravel) {
    profile.flavor = "laravel";
    profile.laravel = await resolveLaravelLayout(root);
  }

  if (node) {
    profile.node = await resolveNodeLayout(root);
    if (!laravel) profile.flavor = "node";
  }

  if (!laravel && !node) {
    profile.flavor = "unknown";
  }

  return { profile };
}
