import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists } from "../fs/async.js";
import { loadRuntimeConfig } from "../config/runtimeConfig.js";

function nodeMajor(): number {
  const m = /^v(\d+)/.exec(process.version);
  return m?.[1] ? Number(m[1]) : 0;
}

function flag(level: string): string {
  switch (level) {
    case "error":
      return "[ERR]";
    case "warn":
      return "[WARN]";
    case "info":
      return "[INFO]";
    default:
      return "[OK]";
  }
}

export interface DoctorLine {
  level: "ok" | "info" | "warn" | "error";
  message: string;
}

export async function collectDoctorLines(repoRoot: string): Promise<DoctorLine[]> {
  const lines: DoctorLine[] = [];
  const major = nodeMajor();
  if (major >= 20) {
    lines.push({ level: "ok", message: `Node ${process.version} (>=20)` });
  } else {
    lines.push({ level: "error", message: `Node ${process.version} — require Node >= 20` });
  }

  const envPath = path.join(repoRoot, ".env");
  if (await pathExists(envPath)) {
    lines.push({ level: "ok", message: `.env present at ${envPath}` });
  } else {
    lines.push({ level: "warn", message: `No .env in repo root — copy .env.example to .env` });
  }

  const distCli = path.join(repoRoot, "dist", "cli.js");
  if (await pathExists(distCli)) {
    lines.push({ level: "ok", message: "dist/cli.js exists (npm run build done)" });
  } else {
    lines.push({ level: "info", message: "dist/cli.js missing — use npm run dev or npm run build before npm start" });
  }

  const cfg = loadRuntimeConfig(repoRoot);
  lines.push({ level: "info", message: `WORKSPACE_PATH → ${cfg.workspacePath}` });
  lines.push({ level: "info", message: `DRY_RUN=${cfg.dryRun} AUTO_APPROVE=${cfg.autoApprove}` });

  const tasksDir = path.join(cfg.workspacePath, "tasks");
  const taskFiles = (await fs.readdir(tasksDir).catch(() => [])).filter((f) => f.endsWith(".json"));
  if (taskFiles.length > 0) {
    lines.push({ level: "ok", message: `Tasks: ${taskFiles.length} JSON file(s) in ${tasksDir}` });
  } else {
    lines.push({ level: "warn", message: `No task JSON in ${tasksDir} — add tasks or run from dispatcher repo to seed samples` });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (token) {
    lines.push({ level: "ok", message: "TELEGRAM_BOT_TOKEN is set" });
  } else {
    lines.push({ level: "info", message: "TELEGRAM_BOT_TOKEN not set — npm run bot:start will fail until set" });
  }

  const chat = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  if (!token) {
    // already noted
  } else if (!chat) {
    lines.push({
      level: "info",
      message: "TELEGRAM_CHAT_ID empty — bootstrap mode: send any text to the bot, copy id from reply, restart",
    });
  } else {
    lines.push({ level: "ok", message: `TELEGRAM_CHAT_ID=${chat}` });
  }

  const wa = process.env.WHATSAPP_ALLOWED_CHAT?.trim();
  if (wa) {
    lines.push({ level: "ok", message: `WHATSAPP_ALLOWED_CHAT=${wa}` });
  } else {
    lines.push({ level: "info", message: "WHATSAPP_ALLOWED_CHAT not set — npm run bot:whatsapp will fail until set" });
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    lines.push({ level: "ok", message: "OPENAI_API_KEY is set (optional coaching)" });
  } else {
    lines.push({ level: "info", message: "OPENAI_API_KEY not set (optional)" });
  }

  if (process.env.GITHUB_TOKEN?.trim() && process.env.GITHUB_REPO?.trim()) {
    lines.push({ level: "ok", message: `GITHUB_REPO=${process.env.GITHUB_REPO!.trim()} (token set)` });
  } else {
    lines.push({ level: "info", message: "GITHUB_TOKEN / GITHUB_REPO not both set (optional automation)" });
  }

  return lines;
}

export async function runDoctor(repoRoot: string): Promise<number> {
  const lines = await collectDoctorLines(repoRoot);
  for (const l of lines) {
    console.log(`${flag(l.level)} ${l.message}`);
  }
  const hasError = lines.some((l) => l.level === "error");
  return hasError ? 1 : 0;
}
