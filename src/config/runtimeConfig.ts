import os from "node:os";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

let loaded = false;

export interface RuntimeConfig {
  workspacePath: string;
  /**
   * If set, scaffolds & project operations use this folder instead of `WORKSPACE_PATH/projects`.
   * Example: ~/Documents/HOHOSOL
   */
  projectsDir?: string;
  dryRun: boolean;
  autoApprove: boolean;
  assistantName: string;
  assistantGreeting: string;
  desktopAllowedPaths: string[];
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
  openRouterModel?: string;
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

  const projectsDir = (() => {
    const raw = process.env.DEVBOT_PROJECTS_DIR?.trim();
    if (!raw) return undefined;
    const expanded = expandHome(raw);
    return path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded);
  })();

  const dryRun = (process.env.DRY_RUN ?? "true").toLowerCase() === "true";
  const autoApprove = (process.env.AUTO_APPROVE ?? "false").toLowerCase() === "true";
  const assistantName = process.env.ASSISTANT_NAME?.trim() || "devBOT";
  const assistantGreeting = process.env.ASSISTANT_GREETING?.trim() || "devBOT ready 🚀";
  const desktopAllowedPaths = (() => {
    const raw = process.env.DESKTOP_ALLOWED_PATHS?.trim();
    if (!raw) return ["~/Desktop", "~/Desktop/future-projects", "~/Desktop/Future Project"];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(expandHome)
      .map((p) => (path.isAbsolute(p) ? p : path.resolve(cwd, p)));
  })();

  return {
    workspacePath,
    projectsDir,
    dryRun,
    autoApprove,
    assistantName,
    assistantGreeting,
    desktopAllowedPaths,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
    openaiModel: process.env.OPENAI_MODEL?.trim() || undefined,
    openRouterModel: process.env.OPENROUTER_MODEL?.trim() || undefined,
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
