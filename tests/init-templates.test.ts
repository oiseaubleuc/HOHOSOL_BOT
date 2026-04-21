import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runInitTemplates } from "../src/commands/initTemplates.js";

describe("init-templates", () => {
  it("copies template files into target directory", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "devbot-init-"));
    const code = await runInitTemplates({ repoRoot: process.cwd(), targetDir: dir, force: true });
    expect(code).toBe(0);
    const task = await fs.readFile(path.join(dir, "devbot-task.example.json"), "utf8");
    expect(task).toContain("APP-001");
    const cfg = await fs.readFile(path.join(dir, "ai-dev-bot.config.example.json"), "utf8");
    expect(cfg).toContain("extraAllowedCommands");
    await fs.rm(dir, { recursive: true, force: true });
  });
});
