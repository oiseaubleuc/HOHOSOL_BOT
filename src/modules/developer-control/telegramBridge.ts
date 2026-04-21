import type { ParsedTelegramCommand } from "../telegram/types.js";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import { sanitizeBrowserUrl, presetUrl, localhostUrl } from "../system/sanitizeUrl.js";
import { openAppOnly, openBrowserUrl, openFinder, openIdeOrApp } from "./adapters/macOpenAdapter.js";
import { listProjectFiles, readProjectFile, treeProjectShallow } from "./adapters/filesystemAdapter.js";
import { gitCommit, gitCreateBranch, gitDiff, gitStatus } from "./adapters/gitAdapter.js";
import { runArtisanSafe, runBuild, runInstall, runLint, runTests } from "./adapters/devCommandsAdapter.js";
import { killPort, listListeningPorts, listProcesses } from "./adapters/portsAdapter.js";
import { inspectProject } from "./inspectProject.js";
import type { ActionResult, ActionType } from "./types.js";
import { gateAndRun, dryRunBlock } from "./gate.js";
import { setActiveProjectName, getActiveProjectName } from "./activeProjectStore.js";
export interface TelegramBridgeContext {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  client: { sendMessage(chatId: number | string, text: string): Promise<void> };
  chatId: number;
}

export function formatActionResult(r: ActionResult): string {
  const lines = [
    `${r.success ? "OK" : "ERR"} · ${r.actionType}`,
    r.summary,
    r.details ? `Details: ${r.details}` : "",
    r.requiresApproval && r.details ? `${r.details}` : "",
    r.output ? `\n${r.output}` : "",
    r.error ? `\nError: ${r.error}` : "",
  ].filter(Boolean);
  return lines.join("\n").slice(0, 4000);
}

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
      await send(fmt(await openIdeOrApp(ws, cmd.target, cmd.project)));
      return true;
    }
    case "browser": {
      if (cmd.mode === "youtube") {
        const url = presetUrl("youtube");
        await send(fmt(await openBrowserUrl(ws, "brave", url)));
        return true;
      }
      if (cmd.mode === "github") {
        const url = presetUrl("github");
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
      await send(["Projects:", ...names.map((n) => `• ${n}`)].join("\n").slice(0, 3500));
      return true;
    }
    case "open_project": {
      setActiveProjectName(cmd.name);
      await send(`Active project: ${cmd.name}\n${fmt(await openFinder(ws, cmd.name))}`);
      return true;
    }
    case "pwd_ws": {
      await send(`WORKSPACE_PATH=\n${ws.root}`);
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

async function handleDevTokens(tokens: string[], ctx: TelegramBridgeContext): Promise<string> {
  const { ws, cfg } = ctx;
  const [a0, a1, a2, a3, ...rest] = tokens;
  const head = a0?.toLowerCase();
  if (!head) return "Usage: /dev …";

  if (head === "projects") {
    const names = await import("node:fs/promises").then((fs) => fs.readdir(ws.projectsDir()).catch(() => []));
    return ["Projects:", ...names.map((n) => `• ${n}`)].join("\n").slice(0, 3500);
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
        summary: "Dev server policy",
        details:
          "Long-running servers are not auto-spawned here. Use /open terminal then run your package manager dev script, or extend with a supervised runner.",
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
    return `Active project: ${active}`;
  }

  return [
    "Unknown /dev command.",
    "Examples:",
    "/dev inspect <project>",
    "/dev install <project>",
    "/dev build <project>",
    "/dev test <project>",
    "/dev git status <project>",
    "/dev git branch <project> <branch>",
    "/dev git commit <project> <message>",
    "/dev file read <project> <relative-path>",
    "/dev artisan <project> route:list",
  ].join("\n");
}
