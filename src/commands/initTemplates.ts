import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../fs/async.js";

const FILES = ["ai-dev-bot.config.example.json", "devbot-task.example.json"] as const;

export interface InitTemplatesOptions {
  repoRoot: string;
  targetDir: string;
  force: boolean;
}

export async function runInitTemplates(opts: InitTemplatesOptions): Promise<number> {
  const srcDir = path.join(opts.repoRoot, "templates", "per-project");
  if (!(await pathExists(srcDir))) {
    console.error(`Missing templates directory: ${srcDir}`);
    return 1;
  }

  const destRoot = path.resolve(opts.targetDir);
  await fs.mkdir(destRoot, { recursive: true });

  for (const name of FILES) {
    const from = path.join(srcDir, name);
    const to = path.join(destRoot, name);
    if ((await pathExists(to)) && !opts.force) {
      console.log(`skip (exists): ${to}`);
      continue;
    }
    await fs.copyFile(from, to);
    console.log(`wrote: ${to}`);
  }

  console.log(
    "\nNext: keep ai-dev-bot.config.example.json in your app repo (rename to ai-dev-bot.config.json when ready). Copy devbot-task.example.json into WORKSPACE_PATH/tasks/<id>.json and set projectRoot to ../projects/<your-clone>.",
  );
  return 0;
}
