import os from "node:os";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

let loaded = false;

export interface RuntimeConfig {
  workspacePath: string;
  dryRun: boolean;
  autoApprove: boolean;
  openaiApiKey?: string;
  githubToken?: string;
  /** `owner/repo` */
  githubRepo?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramPollTimeoutSec: number;
  whatsappAllowedChat?: string;
  whatsappSessionName?: string;
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1).replace(/^\//, ""));
  }
  return p;
}

export function loadRuntimeConfig(cwd = process.cwd()): RuntimeConfig {
  if (!loaded) {
    loadDotenv({ path: path.join(cwd, ".env") });
    loaded = true;
  }

  const workspacePath = (() => {
    const raw = process.env.WORKSPACE_PATH?.trim();
    if (!raw) return path.join(os.homedir(), "devbot-workspace");
    const expanded = expandHome(raw);
    return path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
  })();

  const dryRun = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
  const autoApprove = (process.env.AUTO_APPROVE ?? "false").toLowerCase() === "true";

  return {
    workspacePath,
    dryRun,
    autoApprove,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    githubToken: process.env.GITHUB_TOKEN?.trim() || undefined,
    githubRepo: process.env.GITHUB_REPO?.trim() || undefined,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
    telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() || undefined,
    telegramPollTimeoutSec: Math.min(
      50,
      Math.max(1, Number(process.env.TELEGRAM_POLL_TIMEOUT ?? "45") || 45),
    ),
    whatsappAllowedChat: process.env.WHATSAPP_ALLOWED_CHAT?.trim() || undefined,
    whatsappSessionName: process.env.WHATSAPP_SESSION_NAME?.trim() || undefined,
  };
}

export function resetRuntimeConfigForTests(): void {
  loaded = false;
}
