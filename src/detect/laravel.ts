import fs from "node:fs/promises";
import path from "node:path";
import { listFilesRecursive, pathExists, readJsonFile } from "../fs/async.js";
import type { LaravelLayout } from "../types/project.js";

interface ComposerJson {
  require?: Record<string, string>;
  "require-dev"?: Record<string, string>;
}

export async function isLaravelProject(root: string): Promise<boolean> {
  const artisan = path.join(root, "artisan");
  const composer = path.join(root, "composer.json");
  if (!(await pathExists(artisan)) || !(await pathExists(composer))) return false;
  try {
    const c = await readJsonFile<ComposerJson>(composer);
    const req = { ...c.require, ...c["require-dev"] };
    return Boolean(req["laravel/framework"]);
  } catch {
    return false;
  }
}

export function extractLaravelFrameworkVersion(composer: ComposerJson): string | undefined {
  const v =
    composer.require?.["laravel/framework"] ?? composer["require-dev"]?.["laravel/framework"];
  return typeof v === "string" ? v : undefined;
}

/**
 * Resolves Laravel layout. Assumes `isLaravelProject` already true.
 */
export async function resolveLaravelLayout(root: string): Promise<LaravelLayout> {
  const composerJsonPath = path.join(root, "composer.json");
  const composer = await readJsonFile<ComposerJson>(composerJsonPath);
  const artisanPath = path.join(root, "artisan");

  const phpAppRoot = root;

  const routeDir = path.join(root, "routes");
  const routeFiles: string[] = [];
  if (await pathExists(routeDir)) {
    const ents = await fs.readdir(routeDir, { withFileTypes: true });
    for (const ent of ents) {
      if (!ent.isFile() || !ent.name.endsWith(".php")) continue;
      routeFiles.push(path.join(routeDir, ent.name));
    }
    routeFiles.sort();
  }

  const controllerDir = path.join(root, "app", "Http", "Controllers");
  const modelDirNew = path.join(root, "app", "Models");
  const appDir = path.join(root, "app");

  const controllerFiles = (await listPhpRecursive(controllerDir, 1200)).slice(0, 800);
  const modelFilesModels = (await listPhpRecursive(modelDirNew, 800)).slice(0, 500);
  const modelFilesLegacy = (await listLegacyModels(appDir, modelDirNew)).slice(0, 200);
  const modelFiles = dedupe([...modelFilesModels, ...modelFilesLegacy]);

  const migrationDir = path.join(root, "database", "migrations");
  const migrationFiles = (await safeListPhpFiles(migrationDir)).slice(0, 500);

  const viewsRoot = path.join(root, "resources", "views");
  const bladeFiles = (await listBladeFiles(viewsRoot)).slice(0, 800);

  const configDir = path.join(root, "config");
  const configFiles = (await safeListPhpFiles(configDir)).slice(0, 200);

  const policyDir = path.join(root, "app", "Policies");
  const policyFiles = (await listPhpRecursive(policyDir, 400)).slice(0, 200);

  const middlewareDir = path.join(root, "app", "Http", "Middleware");
  const middlewareFiles = (await listPhpRecursive(middlewareDir, 400)).slice(0, 200);

  const providersDir = path.join(root, "app", "Providers");
  const serviceProviderFiles = (await safeListPhpFiles(providersDir)).slice(0, 100);

  return {
    artisanPath,
    composerJsonPath,
    laravelFrameworkVersion: extractLaravelFrameworkVersion(composer),
    phpAppRoot,
    routeFiles,
    controllerFiles,
    modelFiles,
    migrationFiles,
    bladeFiles,
    configFiles,
    policyFiles,
    middlewareFiles,
    serviceProviderFiles,
  };
}

async function safeListPhpFiles(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith(".php")) continue;
    out.push(path.join(dir, ent.name));
  }
  return out.sort();
}

async function listPhpRecursive(dir: string, maxFiles: number): Promise<string[]> {
  if (!(await pathExists(dir))) return [];
  const all = await listFilesRecursive(dir, {
    maxFiles,
    ignore: (rel) =>
      rel.includes(`${path.sep}vendor${path.sep}`) || rel.includes(`${path.sep}node_modules${path.sep}`),
  });
  return all.filter((f) => f.endsWith(".php")).sort();
}

async function listLegacyModels(appDir: string, modelDirNew: string): Promise<string[]> {
  if (!(await pathExists(appDir))) return [];
  const ents = await fs.readdir(appDir, { withFileTypes: true });
  const out: string[] = [];
  for (const ent of ents) {
    if (!ent.isFile() || !ent.name.endsWith(".php")) continue;
    const full = path.join(appDir, ent.name);
    if (path.normalize(full) === path.normalize(path.join(modelDirNew, ent.name))) continue;
    if (/^[A-Z].*\.php$/.test(ent.name)) out.push(full);
  }
  return out.sort();
}

async function listBladeFiles(viewsRoot: string): Promise<string[]> {
  if (!(await pathExists(viewsRoot))) return [];
  const all = await listFilesRecursive(viewsRoot, {
    maxFiles: 2000,
    ignore: (rel) =>
      rel.includes(`${path.sep}vendor${path.sep}`) ||
      rel.includes(`${path.sep}node_modules${path.sep}`),
  });
  return all.filter((f) => f.endsWith(".blade.php")).sort();
}

function dedupe(paths: string[]): string[] {
  return [...new Set(paths)].sort();
}
