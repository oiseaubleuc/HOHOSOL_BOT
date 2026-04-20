import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "../src/detect/project.js";
import { isLaravelProject, resolveLaravelLayout } from "../src/detect/laravel.js";
import { isNodeProject } from "../src/detect/node.js";
import { loadBotConfig } from "../src/config/loadConfig.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const laravelFixture = path.join(repoRoot, "samples/fixtures/sample-laravel");
const nodeFixture = path.join(repoRoot, "samples/fixtures/sample-node");

describe("detectProject", () => {
  it("classifies the Laravel fixture", async () => {
    expect(await isLaravelProject(laravelFixture)).toBe(true);
    const { profile } = await detectProject(laravelFixture);
    expect(profile.flavor).toBe("laravel");
    expect(profile.laravel?.routeFiles.length).toBeGreaterThan(0);
  });

  it("indexes Laravel layout files", async () => {
    const layout = await resolveLaravelLayout(laravelFixture);
    expect(layout.controllerFiles.some((f) => f.includes("InvoiceController"))).toBe(true);
    expect(layout.bladeFiles.some((f) => f.endsWith("invoice.blade.php"))).toBe(true);
    expect(layout.migrationFiles.length).toBeGreaterThan(0);
  });

  it("classifies the Node fixture", async () => {
    expect(await isNodeProject(nodeFixture)).toBe(true);
    const { profile } = await detectProject(nodeFixture);
    expect(profile.flavor).toBe("node");
    expect(profile.node?.lockfile).toBe("none");
  });
});

describe("loadBotConfig", () => {
  it("returns empty object when missing", async () => {
    const cfg = await loadBotConfig(laravelFixture);
    expect(cfg.extraAllowedPrefixes ?? []).toEqual([]);
  });
});
