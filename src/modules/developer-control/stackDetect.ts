import path from "node:path";
import { readJsonFile, pathExists } from "../../fs/async.js";
import { detectProject } from "../../detect/project.js";

export type StackKind = "laravel" | "nextjs" | "express" | "node" | "typescript" | "php" | "javascript" | "unknown";

export interface StackSummary {
  kind: StackKind;
  packageManager: "npm" | "pnpm" | "yarn" | "none";
  hasTypeScript: boolean;
  scripts: Record<string, string>;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function summarizeStack(projectRoot: string): Promise<StackSummary> {
  const { profile } = await detectProject(projectRoot);
  const pkgPath = path.join(projectRoot, "package.json");
  const hasPkg = await pathExists(pkgPath);
  let scripts: Record<string, string> = {};
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};
  if (hasPkg) {
    const pkg = await readJsonFile<PackageJson>(pkgPath);
    scripts = pkg.scripts ?? {};
    deps = pkg.dependencies ?? {};
    devDeps = pkg.devDependencies ?? {};
  }
  const all = { ...deps, ...devDeps };
  const hasNext = Boolean(all.next);
  const hasExpress = Boolean(all.express);
  const hasTs = (await pathExists(path.join(projectRoot, "tsconfig.json"))) || Boolean(all.typescript);
  const pm = profile.node?.lockfile === "pnpm" ? "pnpm" : profile.node?.lockfile === "yarn" ? "yarn" : hasPkg ? "npm" : "none";

  let kind: StackKind = "unknown";
  if (profile.flavor === "laravel") kind = "laravel";
  else if (hasNext) kind = "nextjs";
  else if (hasExpress) kind = "express";
  else if (hasTs) kind = "typescript";
  else if (hasPkg) kind = "javascript";
  if (await pathExists(path.join(projectRoot, "composer.json")) && kind === "unknown") kind = "php";

  return { kind, packageManager: pm, hasTypeScript: hasTs, scripts };
}

export function pickScript(scripts: Record<string, string>, preferred: string[]): string | undefined {
  for (const p of preferred) {
    if (scripts[p]) return p;
  }
  return undefined;
}

export function devCommandsForStack(s: StackSummary): {
  install: string[];
  build?: string[];
  test?: string[];
  lint?: string[];
  dev?: string[];
} {
  const pm = s.packageManager;
  const run = (script: string): string[] => {
    if (pm === "pnpm") return ["pnpm", "run", script];
    if (pm === "yarn") return ["yarn", script];
    return ["npm", "run", script];
  };
  const install: string[] =
    pm === "pnpm" ? ["pnpm", "install"] : pm === "yarn" ? ["yarn", "install"] : pm === "npm" ? ["npm", "install"] : [];

  const b = pickScript(s.scripts, ["build", "prod"]);
  const t = pickScript(s.scripts, ["test", "unit"]);
  const l = pickScript(s.scripts, ["lint", "eslint"]);
  const d = pickScript(s.scripts, ["dev", "start", "serve"]);

  return {
    install,
    build: b ? run(b) : undefined,
    test: t ? run(t) : undefined,
    lint: l ? run(l) : undefined,
    dev: d ? run(d) : undefined,
  };
}

export async function laravelInspectArgv(projectRoot: string): Promise<string[][]> {
  const artisan = path.join(projectRoot, "artisan");
  if (!(await pathExists(artisan))) return [];
  return [
    ["php", artisan, "route:list"],
    ["php", artisan, "test"],
  ];
}
