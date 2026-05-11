import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ParsedTelegramCommand } from "./types.js";
import { TaskRegistry } from "../../services/taskRegistry.js";
import { StatusService } from "../../services/statusService.js";
import { ApprovalBus } from "../../approvals/approvalBus.js";
import { RunningTaskRegistry } from "../../state/runningTasks.js";
import { runAgentPipeline } from "../../execution/agentPipeline.js";
import { createScaffoldedProject } from "../../projects/projectCreator.js";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import { formatActionResult, handleExtendedTelegramCommand } from "../developer-control/telegramBridge.js";
import { createDesktopFolder, createDesktopFolderInBase, resolveFolderInsideBase } from "../system/createDesktopFolder.js";
import { assertPathInDesktopAllowlist } from "../system/pathGuard.js";
import { approveDevAction, rejectDevAction, listPendingDevActions } from "../developer-control/actionQueue.js";
import { getActiveProjectName } from "../developer-control/activeProjectStore.js";
import { gateAndRun } from "../developer-control/gate.js";
import { planAskInstruction } from "./askPlanner.js";
import { runAssistantChat } from "./telegramAssistantChat.js";
import { callHohobotAgent, callHohobotChat } from "./hohobotBridge.js";
import { formatLogTailForTelegram, humanizePipelinePhase, truncateTelegram } from "./telegramUx.js";
import { devBotInlineMenu, devBotReplyKeyboard, inlineMenuIntroText } from "./telegramKeyboards.js";
import { devBotStartLines, devBotHelpFull, devBotQuickSheet } from "./telegramHelpMessages.js";
import type { TelegramSendOptions } from "./telegramClient.js";

export interface TelegramBotContext {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  client: {
    sendMessage(chatId: number | string, text: string, options?: TelegramSendOptions): Promise<void>;
  };
  chatId: number;
  registry: TaskRegistry;
  status: StatusService;
  running: RunningTaskRegistry;
}

export async function dispatchTelegramCommand(cmd: ParsedTelegramCommand, ctx: TelegramBotContext): Promise<void> {
  const send = (text: string, opts?: TelegramSendOptions) =>
    ctx.client.sendMessage(ctx.chatId, truncateTelegram(text), opts);
  const bus = ApprovalBus.get();

  try {
    switch (cmd.kind) {
      case "start":
        await send(devBotStartLines(ctx.cfg).join("\n"), { reply_markup: devBotReplyKeyboard() });
        ctx.status.record("/start");
        return;

      case "help":
        await send(devBotHelpFull(ctx.cfg), { reply_markup: devBotReplyKeyboard() });
        ctx.status.record("/help");
        return;

      case "quick":
        await send(devBotQuickSheet(ctx.cfg), { reply_markup: devBotReplyKeyboard() });
        ctx.status.record("/quick");
        return;

      case "menu":
        await send(inlineMenuIntroText(), {
          reply_markup: devBotInlineMenu(),
        });
        ctx.status.record("/menu");
        return;

      case "tasks": {
        await ctx.registry.refresh();
        const tasks = ctx.registry.list();
        if (tasks.length === 0) {
          await send(`📭 Aucune tâche.\nDossier : ${ctx.ws.tasksDir()}`);
        } else {
          await send(
            [
              "📋 Tâches — `/run <id>` puis `/approve <id>` (ou `/reject`)",
              ...tasks.map((t) => `• \`${t.id}\` — ${t.title}`),
            ].join("\n"),
          );
        }
        ctx.status.record("/tasks");
        return;
      }

      case "run": {
        await ctx.registry.refresh();
        const reg = ctx.registry.findById(cmd.taskId);
        if (!reg) {
          await send(`❓ Unknown task \`${cmd.taskId}\` — try \`/tasks\`.`);
          return;
        }
        if (ctx.running.isRunning(cmd.taskId)) {
          await send(`⏳ \`${cmd.taskId}\` is already running. \`/status\` for phase.`);
          return;
        }
        setImmediate(() => {
          void runAgentPipeline(cmd.taskId, reg.filePath, reg.title, {
            ws: ctx.ws,
            cfg: ctx.cfg,
            running: ctx.running,
            bus,
            notify: (text) => send(text),
          }).catch((err) => console.error("[devBOT] pipeline error", err));
        });
        await send(
          [
            `▶ Started \`${cmd.taskId}\``,
            reg.title,
            `You’ll get step pings here. First: \`/approve ${cmd.taskId}\``,
            `📎 /logs ${cmd.taskId}`,
          ].join("\n"),
        );
        ctx.status.record(`/run ${cmd.taskId}`);
        return;
      }

      case "approve": {
        if (cmd.taskId.startsWith("DEV-")) {
          const res = await approveDevAction(cmd.taskId);
          await send(
            res ? `🔓 Ran approved action\n${formatActionResult(res)}` : `Nothing queued for \`${cmd.taskId}\`.`,
          );
          ctx.status.record(`/approve ${cmd.taskId}`);
          return;
        }
        const ok = bus.approveNext(cmd.taskId);
        const next = bus.peek(cmd.taskId);
        await send(
          ok
            ? `✅ Unlocked next step for \`${cmd.taskId}\`${next ? `\n⏳ Still waiting: ${next}` : ""}`
            : `Nothing waiting for \`${cmd.taskId}\`.`,
        );
        ctx.status.record(`/approve ${cmd.taskId}`);
        return;
      }

      case "reject": {
        if (cmd.taskId.startsWith("DEV-")) {
          const ok = rejectDevAction(cmd.taskId);
          await send(ok ? `🛑 Cancelled \`${cmd.taskId}\`.` : `No queue entry for \`${cmd.taskId}\`.`);
          ctx.status.record(`/reject ${cmd.taskId}`);
          return;
        }
        const n = bus.rejectTask(cmd.taskId);
        ctx.running.kill(cmd.taskId);
        await send(n ? `🛑 Cleared ${n} gate(s) for \`${cmd.taskId}\`.` : `No gates open for \`${cmd.taskId}\`.`);
        ctx.status.record(`/reject ${cmd.taskId}`);
        return;
      }

      case "status": {
        const running = ctx.running
          .list()
          .filter((t) => !["completed", "failed", "killed"].includes(t.phase));
        const s = ctx.status.get();
        const pend = listPendingDevActions();
        const activeProject = getActiveProjectName();
        const lines = [
          "📊 Status",
          `• Last: ${s.summary}`,
          `• ${ctx.cfg.dryRun ? "🧪 DRY_RUN" : "⚡ LIVE"} · approvals: ${ctx.cfg.autoApprove ? "AUTO" : "manual"}`,
          `• Workspace: ${ctx.ws.root}`,
          activeProject ? `• Active project: ${activeProject}` : "• Active project: —",
        ];
        if (running.length) {
          lines.push(
            "• Pipelines:",
            ...running.map((r) => `  ◦ ${r.taskId}: ${humanizePipelinePhase(r.phase)}`),
          );
        } else {
          lines.push("• Pipelines: none");
        }
        if (pend.length) {
          lines.push(
            "• DEV queue:",
            ...pend.map((p) => `  ◦ ${p.id} — ${p.summary}`),
            "  → `/approve <id>` or `/reject <id>`",
          );
        }
        await send(lines.join("\n"));
        return;
      }

      case "logs": {
        const p = ctx.ws.logFile(cmd.taskId);
        try {
          const raw = await fs.readFile(p, "utf8");
          if (!raw.trim()) {
            await send(`📋 \`${cmd.taskId}\` log is empty.`);
            return;
          }
          await send(formatLogTailForTelegram(raw, 28, true));
        } catch {
          await send(`No log file for \`${cmd.taskId}\` yet.`);
        }
        return;
      }

      case "report": {
        const p = ctx.ws.reportFile(cmd.taskId, "agent");
        try {
          const raw = await fs.readFile(p, "utf8");
          const body = raw.trim() ? raw.trim().slice(0, 3200) : "";
          await send(
            body
              ? `📄 Agent report · \`${cmd.taskId}\`\n\n\`\`\`\n${body}\n\`\`\``
              : `No agent report for \`${cmd.taskId}\` yet.`,
          );
        } catch {
          await send(`No agent report for \`${cmd.taskId}\` yet.`);
        }
        return;
      }

      case "kill": {
        const ok = ctx.running.kill(cmd.taskId);
        bus.rejectTask(cmd.taskId);
        await send(ok ? `🛑 Stopped runner for \`${cmd.taskId}\`.` : `No active runner for \`${cmd.taskId}\`.`);
        return;
      }

      case "workspace": {
        const projects = await fs.readdir(ctx.ws.projectsDir()).catch(() => []);
        await send(
          [
            "🗂 Workspace",
            `Racine (tasks, logs, …) : ${ctx.ws.root}`,
            `Dossier projets : ${ctx.ws.projectsDir()}`,
            "",
            projects.length ? ["Projets :", ...projects.map((p) => ` • ${p}`)].join("\n") : "Projets : (vide)",
            "",
            `Tâches : ${ctx.ws.tasksDir()}`,
          ].join("\n"),
        );
        return;
      }

      case "health": {
        const mem = process.memoryUsage();
        const llm = ctx.cfg.openaiApiKey
          ? `LLM: OpenAI (${ctx.cfg.openaiModel ?? "default"})`
          : ctx.cfg.openRouterModel
            ? `LLM: OpenRouter model cfg (${ctx.cfg.openRouterModel})`
            : "LLM: off";
        await send(
          [
            "🩺 Worker",
            `• Host: ${os.hostname()}`,
            `• RSS: ${Math.round(mem.rss / 1024 / 1024)} MB · up ${Math.round(process.uptime())}s`,
            `• Workspace: ${ctx.ws.root}`,
            `• ${llm}`,
          ].join("\n"),
        );
        return;
      }

      case "open":
      case "browser":
      case "projects":
      case "open_project":
      case "pwd_ws":
      case "tree":
      case "files":
      case "dev":
      case "ports":
      case "processes":
      case "kill_port": {
        await handleExtendedTelegramCommand(cmd, ctx);
        return;
      }

      case "system": {
        if (cmd.action === "create-folder") {
          const res = await gateAndRun(ctx.cfg, "CREATE_FOLDER", `create desktop folder ${cmd.folderName}`, async () => {
            const r = await createDesktopFolder(ctx.ws, cmd.folderName);
            return { success: r.ok, actionType: "CREATE_FOLDER", summary: r.message, output: r.target };
          });
          await send(formatActionResult(res));
          ctx.status.record(`/system create-folder ${cmd.folderName}`);
        } else if (cmd.action === "create-folder-in-desktop") {
          const root = path.join(os.homedir(), "Desktop");
          assertPathInDesktopAllowlist(ctx.cfg, root);
          const res = await gateAndRun(
            ctx.cfg,
            "CREATE_FOLDER",
            `create folder in desktop ${cmd.folderName}`,
            async () => {
              const r = await createDesktopFolderInBase(ctx.ws, root, cmd.folderName);
              return { success: r.ok, actionType: "CREATE_FOLDER", summary: r.message, output: r.target };
            },
          );
          await send(formatActionResult(res));
          ctx.status.record(`/system create-folder-in-desktop ${cmd.folderName}`);
        } else if (cmd.action === "create-folder-in-future-projects") {
          const baseA = path.join(os.homedir(), "Desktop", "future-projects");
          const baseB = path.join(os.homedir(), "Desktop", "Future Project");
          const preferred = ctx.cfg.desktopAllowedPaths.find((p) => {
            const rp = path.resolve(p);
            return rp === path.resolve(baseA) || rp === path.resolve(baseB);
          });
          const root = preferred ? path.resolve(preferred) : path.resolve(baseA);
          assertPathInDesktopAllowlist(ctx.cfg, resolveFolderInsideBase(root, cmd.folderName));
          const res = await gateAndRun(
            ctx.cfg,
            "CREATE_FOLDER",
            `create folder in future-projects ${cmd.folderName}`,
            async () => {
              const r = await createDesktopFolderInBase(ctx.ws, root, cmd.folderName);
              return { success: r.ok, actionType: "CREATE_FOLDER", summary: r.message, output: r.target };
            },
          );
          await send(formatActionResult(res));
          ctx.status.record(`/system create-folder-in-future-projects ${cmd.folderName}`);
        }
        return;
      }

      case "hohobot_ai": {
        try {
          const reply = await callHohobotChat(ctx.cfg, cmd.message, "orchestrator");
          await send(reply);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          await send(
            [
              "❌ `/ai` — impossible d’atteindre HOHOBOT.",
              "Sur l’iMac : `hobot serve --port 8000` (ou `HOHOBOT_BASE_URL` si autre port).",
              m ? `Détail : ${m}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }
        ctx.status.record("/ai");
        return;
      }

      case "hohobot_agent": {
        try {
          const reply = await callHohobotAgent(ctx.cfg, cmd.message);
          await send(reply);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          await send(
            [
              "❌ `/agent` — échec (Claude + outils).",
              "Vérifie : `hobot serve`, `ANTHROPIC_API_KEY` côté Python, `HOHOBOT_BASE_URL` / token si besoin.",
              m ? `Détail : ${m}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }
        ctx.status.record("/agent");
        return;
      }

      case "assistant_chat": {
        if (!cmd.message.trim()) {
          await send(
            [
              "💬 Conversation (style ChatGPT, rien n’est exécuté sur le Mac)",
              "",
              "Exemple :",
              "`/chat Explique-moi les promesses JS en 5 lignes`",
              "",
              "Ou touche « 💬 Chat » puis envoie : `/chat` + ta question dans le même message.",
              "",
              "🔑 `OPENAI_API_KEY` requis. Pour lancer une action sur l’iMac : phrase sans `/` ou les boutons.",
            ].join("\n"),
          );
          ctx.status.record("/chat (hint)");
          return;
        }
        try {
          const reply = await runAssistantChat(cmd.message, ctx.cfg);
          await send(reply);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          await send(`❌ /chat : ${m}`);
        }
        ctx.status.record("/chat");
        return;
      }

      case "ask": {
        const plan = await planAskInstruction(cmd.instruction, ctx.cfg);
        if (plan.needsClarification || !plan.mapped) {
          await send(plan.clarifyMessage ?? "🤔 Say what to do on the iMac in one sentence (project name helps).");
          return;
        }
        await send(`💬 Mapped to:\n${plan.slash}`);
        await dispatchTelegramCommand(plan.mapped, ctx);
        return;
      }

      case "create": {
        const key = `create:${cmd.name}`;
        setImmediate(() => {
          void (async () => {
            try {
              await createScaffoldedProject({
                ws: ctx.ws,
                projectName: cmd.name,
                type: cmd.type,
                dryRun: ctx.cfg.dryRun,
                bus,
                logKey: key,
              });
              await send(
                `✅ \`${cmd.name}\` (${cmd.type})\n📂 ${path.join(ctx.ws.projectsDir(), cmd.name)}\n→ \`/open-project ${cmd.name}\` or \`/dev inspect ${cmd.name}\``,
              );
            } catch (e) {
              const m = e instanceof Error ? e.message : String(e);
              await send(`❌ Create failed\n${m}`);
            }
          })();
        });
        await send(
          [
            `📦 Scaffold \`${cmd.name}\` (${cmd.type})`,
            `⏸ Approve: \`/approve ${key}\``,
            ctx.cfg.dryRun ? "🧪 DRY_RUN may skip heavy install steps." : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }

      case "unknown":
        await send(`❓ Unrecognized: ${cmd.raw}\nTry \`/help\` or \`/ask …\`.`);
        ctx.status.record(`unknown: ${cmd.raw}`);
        return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await send(`⚠️ Something went wrong\n${msg}`);
    ctx.status.record(`error: ${msg}`);
  }
}
