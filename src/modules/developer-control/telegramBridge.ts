import type { ParsedTelegramCommand } from "../telegram/types.js";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import {
  sanitizeBrowserUrl,
  presetUrl,
  localhostUrl,
  youtubeSearchResultsUrl,
  githubSearchResultsUrl,
} from "../system/sanitizeUrl.js";
import { openAppOnly, openBrowserUrl, openFinder, openIdeOrApp, openMacBundleApp } from "./adapters/macOpenAdapter.js";
import { resolveMacBundleKey } from "./adapters/macBundles.js";
import { listProjectFiles, readProjectFile, treeProjectShallow } from "./adapters/filesystemAdapter.js";
import { gitCommit, gitCreateBranch, gitDiff, gitPush, gitStatus } from "./adapters/gitAdapter.js";
import { runArtisanSafe, runBuild, runInstall, runLint, runTests } from "./adapters/devCommandsAdapter.js";
import { killPort, listListeningPorts, listProcesses } from "./adapters/portsAdapter.js";
import { inspectProject } from "./inspectProject.js";
import type { ActionResult, ActionType } from "./types.js";
import { gateAndRun, dryRunBlock } from "./gate.js";
import { setActiveProjectName, getActiveProjectName } from "./activeProjectStore.js";
import { formatActionResultForTelegram, truncateTelegram } from "../telegram/telegramUx.js";
import type { TelegramSendOptions } from "../telegram/telegramClient.js";

export interface TelegramBridgeContext {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  client: { sendMessage(chatId: number | string, text: string, options?: TelegramSendOptions): Promise<void> };
  chatId: number;
}

export const formatActionResult = formatActionResultForTelegram;

const fmt = formatActionResult;

async function gated(
  ctx: TelegramBridgeContext,
  type: ActionType,
  summary: string,
  run: () => Promise<ActionResult>,
): Promise<string> {
  const dry = dryRunBlock(ctx.cfg, type, summary);
  if (dry) return fmt(dry);
  return fmt(await gateAndRun(ctx.cfg, type, summary, run));
}

export async function handleExtendedTelegramCommand(cmd: ParsedTelegramCommand, ctx: TelegramBridgeContext): Promise<boolean> {
  const send = (t: string) => ctx.client.sendMessage(ctx.chatId, t);
  const { ws } = ctx;

  switch (cmd.kind) {
    case "open": {
      const mac = resolveMacBundleKey(cmd.target);
      if (mac) {
        await send(fmt(await openMacBundleApp(ws, mac)));
        return true;
      }
      if (cmd.target === "finder") {
        await send(fmt(await openFinder(ws, cmd.project)));
        return true;
      }
      if (cmd.target === "brave") {
        await send(fmt(await openAppOnly(ws, "brave")));
        return true;
      }
      if (cmd.target === "safari") {
        await send(fmt(await openAppOnly(ws, "safari")));
        return true;
      }
      await send(
        fmt(await openIdeOrApp(ws, cmd.target as "cursor" | "vscode" | "terminal", cmd.project)),
      );
      return true;
    }
    case "browser": {
      if (cmd.mode === "youtube") {
        const built = cmd.query?.trim()
          ? youtubeSearchResultsUrl(cmd.query.trim())
          : presetUrl("youtube");
        const url = sanitizeBrowserUrl(built);
        await send(fmt(await openBrowserUrl(ws, "brave", url)));
        return true;
      }
      if (cmd.mode === "github") {
        const built = cmd.query?.trim()
          ? githubSearchResultsUrl(cmd.query.trim())
          : presetUrl("github");
        const url = sanitizeBrowserUrl(built);
        await send(fmt(await openBrowserUrl(ws, "brave", url)));
        return true;
      }
      if (cmd.mode === "localhost" && cmd.port) {
        const url = localhostUrl(cmd.port);
        await send(fmt(await openBrowserUrl(ws, "brave", url)));
        return true;
      }
      if (cmd.mode === "url" && cmd.url) {
        const safe = sanitizeBrowserUrl(cmd.url);
        await send(fmt(await openBrowserUrl(ws, "brave", safe)));
        return true;
      }
      return true;
    }
    case "projects": {
      const names = await import("node:fs/promises").then((fs) => fs.readdir(ws.projectsDir()).catch(() => []));
      const body =
        names.length === 0
          ? "📂 No projects yet — use `/create` or clone under `projects/`."
          : ["📂 Projects", ...names.map((n) => `• ${n}`)].join("\n");
      await send(truncateTelegram(body));
      return true;
    }
    case "open_project": {
      setActiveProjectName(cmd.name);
      await send(truncateTelegram(`📌 Active: ${cmd.name}\n${fmt(await openFinder(ws, cmd.name))}`));
      return true;
    }
    case "pwd_ws": {
      await send(truncateTelegram(`📁 Workspace\n${ws.root}`));
      return true;
    }
    case "tree": {
      await send(fmt(await treeProjectShallow(ws, cmd.project)));
      return true;
    }
    case "files": {
      await send(fmt(await listProjectFiles(ws, cmd.project)));
      return true;
    }
    case "ports": {
      await send(fmt(await listListeningPorts(ws)));
      return true;
    }
    case "processes": {
      await send(fmt(await listProcesses(ws)));
      return true;
    }
    case "kill_port": {
      await send(
        await gated(ctx, "KILL_PORT", `kill port ${cmd.port}`, async () => killPort(ws, cmd.port)),
      );
      return true;
    }
    case "dev": {
      await send(await handleDevTokens(cmd.tokens, ctx));
      return true;
    }
    default:
      return false;
  }
}

function devCommandHelpFr(): string {
  return [
    "🛠 `/dev` — lance des **outils en ligne de commande** sur un **projet** (dossier sous ton répertoire projets du bot).",
    "",
    "Exemples :",
    "• `/dev inspect <projet>` — détecte la stack (Node, Laravel…)",
    "• `/dev build|test|lint|install <projet>`",
    "• `/dev git status|diff <projet>` · `/dev git commit <projet> message` · `/dev git push <projet>`",
    "• `/dev file read <projet> chemin/relatif`",
    "• `/dev artisan <projet> …` (Laravel)",
    "• `/dev open cursor <projet>` — ouvre **Cursor** directement sur ce dossier",
    "",
    "🎯 Bouton « Cursor » (Telegram)",
    "Ouvre l’app Cursor (souvent sur la racine workspace). Pour ouvrir **un projet précis** :",
    "`/open cursor <nom-du-dossier>` ou `/dev open cursor <nom-du-dossier>`",
    "",
    "💬 Chat IA **dans** Cursor",
    "Composer / Chat de Cursor ne sont **pas** branchés sur Telegram : une fois Cursor ouvert sur le Mac, utilise **Cmd+L** (ou le panneau Chat) **dans Cursor** pour lancer le projet, le débugger, etc.",
    "Sur Telegram : `/chat` = conseils ; phrase sans `/` ou boutons = **actions** sur le Mac.",
  ].join("\n");
}

async function handleDevTokens(tokens: string[], ctx: TelegramBridgeContext): Promise<string> {
  const { ws, cfg } = ctx;
  if (tokens.length === 0) {
    return truncateTelegram(devCommandHelpFr());
  }
  const [a0, a1, a2, a3, ...rest] = tokens;
  const head = a0?.toLowerCase();
  if (!head) return truncateTelegram(devCommandHelpFr());

  if (head === "projects") {
    const names = await import("node:fs/promises").then((fs) => fs.readdir(ws.projectsDir()).catch(() => []));
    if (names.length === 0) return "📂 No projects in workspace yet.";
    return truncateTelegram(["📂 Projects", ...names.map((n) => `• ${n}`)].join("\n"));
  }

  if (head === "inspect" && a1) {
    return fmt(await inspectProject(ws, a1));
  }

  if (head === "install" && a1) {
    return await gated(ctx, "INSTALL_DEPENDENCIES", `npm/pnpm install in ${a1}`, () => runInstall(ws, a1));
  }
  if (head === "build" && a1) {
    return fmt(await runBuild(ws, a1));
  }
  if (head === "test" && a1) {
    return fmt(await runTests(ws, a1));
  }
  if (head === "lint" && a1) {
    return fmt(await runLint(ws, a1));
  }
  if (head === "devserver" && a1) {
    const dr = dryRunBlock(cfg, "RUN_DEV_SERVER", "dev server");
    if (dr) return fmt(dr);
    return fmt(
      await gateAndRun(cfg, "RUN_DEV_SERVER", `dev server ${a1}`, async () => ({
        success: true,
        actionType: "RUN_DEV_SERVER",
        summary: "Dev servers are not auto-started (safety).",
        details: "Use `/open terminal` on the iMac, cd into the project, then run your usual dev script (npm/pnpm/yarn).",
      })),
    );
  }

  if (head === "open" && a1 === "cursor" && a2) {
    return fmt(await openIdeOrApp(ws, "cursor", a2));
  }
  if (head === "open" && a1 === "vscode" && a2) {
    return fmt(await openIdeOrApp(ws, "vscode", a2));
  }

  if (head === "git" && a1 === "status" && a2) {
    return fmt(await gitStatus(ws, a2));
  }
  if (head === "git" && a1 === "diff" && a2) {
    return fmt(await gitDiff(ws, a2));
  }
  if (head === "git" && a1 === "branch" && a2 && a3) {
    return await gated(ctx, "GIT_CREATE_BRANCH", `branch ${a3} in ${a2}`, () => gitCreateBranch(ws, a2, a3));
  }
  if (head === "git" && a1 === "commit" && a2) {
    const msg = [a3, ...rest].filter(Boolean).join(" ").trim();
    if (!msg) return "Usage: /dev git commit <project> <message>";
    return await gated(ctx, "GIT_COMMIT", `commit in ${a2}`, () => gitCommit(ws, a2, msg));
  }
  if (head === "git" && a1 === "push" && a2) {
    return await gated(ctx, "GIT_PUSH", `push in ${a2}`, () => gitPush(ws, a2));
  }

  if (head === "file" && a1 === "list" && a2) {
    return fmt(await listProjectFiles(ws, a2));
  }
  if (head === "file" && a1 === "read" && a2 && a3) {
    const rel = [a3, ...rest].join(" ").trim();
    return fmt(await readProjectFile(ws, a2, rel));
  }

  if (head === "browser" && a1 === "open" && a2) {
    const urlRaw = [a2, a3, ...rest].join(" ").trim();
    const safe = sanitizeBrowserUrl(urlRaw);
    return fmt(await openBrowserUrl(ws, "brave", safe));
  }

  if (head === "artisan" && a1) {
    const argvTail = tokens.slice(2);
    if (argvTail.length === 0) return "Usage: /dev artisan <project> <subcommand...>";
    return fmt(await runArtisanSafe(ws, a1, argvTail));
  }

  const active = getActiveProjectName();
  if (head === "pwd" && active) {
    return `📌 Active project: ${active}`;
  }

  return [
    "❓ Unknown `/dev` — try:",
    "`/dev inspect <project>`",
    "`/dev build|test|lint|install <project>`",
    "`/dev git status|diff|branch|commit|push …`",
    "`/dev file read <project> <path>`",
    "`/dev artisan <project> route:list`",
  ].join("\n");
}
