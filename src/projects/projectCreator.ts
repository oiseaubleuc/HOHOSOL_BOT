import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { WorkspaceManager } from "../workspace/workspaceManager.js";
import type { ApprovalBus } from "../approvals/approvalBus.js";
import { TaskLog } from "../logging/taskLog.js";

import type { ScaffoldType } from "../types/scaffold.js";

function safeName(name: string): string {
  const s = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!s) throw new Error("Invalid project name");
  return s.slice(0, 64);
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(root, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content, "utf8");
  }
}

const templates: Record<ScaffoldType, Record<string, string>> = {
  "node-api": {
    "package.json": JSON.stringify(
      {
        name: "PLACEHOLDER",
        private: true,
        type: "module",
        scripts: { start: "node src/server.js", test: "node --test" },
      },
      null,
      2,
    ),
    "src/server.js": `import http from "node:http";\nconst port = process.env.PORT || 3000;\nhttp.createServer((req,res)=>{\n  if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true}));}\n  res.writeHead(404);res.end();\n}).listen(port,()=>console.log("listening",port));\n`,
    "README.md": "# API\n\n`npm start`\n",
  },
  nextjs: {
    "package.json": JSON.stringify(
      {
        name: "PLACEHOLDER",
        private: true,
        scripts: { dev: "next dev", build: "next build", start: "next start" },
        dependencies: { next: "^15.0.0", react: "^19.0.0", "react-dom": "^19.0.0" },
      },
      null,
      2,
    ),
    "next.config.mjs": "export default { reactStrictMode: true };\n",
    "app/page.tsx": "export default function Page(){return <main><h1>devBOT scaffold</h1></main>;}\n",
    "README.md": "# Next.js scaffold\n\nRun `npm install` then `npm run dev`.\n",
  },
  laravel: {
    "composer.json": JSON.stringify(
      {
        name: "placeholder/app",
        require: { "laravel/framework": "^11.0" },
      },
      null,
      2,
    ),
    "artisan": "#!/usr/bin/env php\n<?php\n// Run `composer install` then `php artisan key:generate`.\n",
    "README.md": "# Laravel scaffold\n\nRun `composer install`.\n",
  },
  "saas-template": {
    "README.md": "# SaaS template (minimal)\n\n- `apps/web` — add your Next.js app\n- `packages/ui` — shared components\n",
    "package.json": JSON.stringify(
      { name: "PLACEHOLDER-monorepo", private: true, workspaces: ["apps/*", "packages/*"] },
      null,
      2,
    ),
    "apps/web/package.json": JSON.stringify({ name: "web", private: true, scripts: { dev: "next dev" } }, null, 2),
  },
};

export async function createScaffoldedProject(input: {
  ws: WorkspaceManager;
  projectName: string;
  type: ScaffoldType;
  dryRun: boolean;
  bus: ApprovalBus;
  logKey: string;
}): Promise<{ target: string; log: string }> {
  const name = safeName(input.projectName);
  const target = path.join(input.ws.projectsDir(), name);
  input.ws.assertPathInWorkspace(target);
  const log = new TaskLog(input.ws.logFile(input.logKey));

  await input.bus.wait(input.logKey, `Approve creating project "${name}" (${input.type}) under workspace`);
  if (input.dryRun) {
    await log.line("INFO", "DRY_RUN: would create", { target, type: input.type });
    return { target, log: "dry-run only" };
  }

  await fs.mkdir(target, { recursive: true });
  const files = templates[input.type];
  if (!files) throw new Error(`Unknown scaffold type: ${input.type}`);
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    resolved[k] = v.replaceAll("PLACEHOLDER", name);
  }
  await writeFiles(target, resolved);
  await log.line("INFO", "Scaffold written", { target });

  if (input.type === "node-api" || input.type === "nextjs") {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("npm", ["install"], { cwd: target, shell: false, stdio: "pipe" });
      let err = "";
      child.stderr?.on("data", (d) => {
        err += String(d);
      });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`npm install failed: ${err}`))));
      child.on("error", reject);
    });
    await log.line("INFO", "npm install completed", { target });
  }

  return { target, log: "ok" };
}
