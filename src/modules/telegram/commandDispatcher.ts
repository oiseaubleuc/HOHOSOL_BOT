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
import { approveDevAction, rejectDevAction, listPendingDevActions } from "../developer-control/actionQueue.js";

export interface TelegramBotContext {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  client: {
    sendMessage(chatId: number | string, text: string): Promise<void>;
  };
  chatId: number;
  registry: TaskRegistry;
  status: StatusService;
  running: RunningTaskRegistry;
}

export async function dispatchTelegramCommand(cmd: ParsedTelegramCommand, ctx: TelegramBotContext): Promise<void> {
  const send = (text: string) => ctx.client.sendMessage(ctx.chatId, text);
  const bus = ApprovalBus.get();

  try {
    switch (cmd.kind) {
      case "start":
        await send("devBOT ready 🚀");
        ctx.status.record("/start");
        return;

      case "tasks": {
        await ctx.registry.refresh();
        const tasks = ctx.registry.list();
        if (tasks.length === 0) {
          await send(`No tasks in ${ctx.ws.tasksDir()}`);
        } else {
          await send(tasks.map((t) => `• ${t.id} — ${t.title}`).join("\n"));
        }
        ctx.status.record("/tasks");
        return;
      }

      case "run": {
        await ctx.registry.refresh();
        const reg = ctx.registry.findById(cmd.taskId);
        if (!reg) {
          await send(`Unknown task id: ${cmd.taskId}. Try /tasks.`);
          return;
        }
        if (ctx.running.isRunning(cmd.taskId)) {
          await send(`Task ${cmd.taskId} is already running.`);
          return;
        }
        setImmediate(() => {
          void runAgentPipeline(cmd.taskId, reg.filePath, reg.title, {
            ws: ctx.ws,
            cfg: ctx.cfg,
            running: ctx.running,
            bus,
          }).catch((err) => console.error("[devBOT] pipeline error", err));
        });
        await send(
          [
            `Started pipeline for ${cmd.taskId}.`,
            `First gate: /approve ${cmd.taskId}`,
            `Logs: ${ctx.ws.logFile(cmd.taskId)}`,
          ].join("\n"),
        );
        ctx.status.record(`/run ${cmd.taskId}`);
        return;
      }

      case "approve": {
        if (cmd.taskId.startsWith("DEV-")) {
          const res = await approveDevAction(cmd.taskId);
          await send(res ? formatActionResult(res) : `No pending DEV action ${cmd.taskId}`);
          ctx.status.record(`/approve ${cmd.taskId}`);
          return;
        }
        const ok = bus.approveNext(cmd.taskId);
        await send(ok ? `Approved next step for ${cmd.taskId}.` : `No pending approval for ${cmd.taskId}.`);
        ctx.status.record(`/approve ${cmd.taskId}`);
        return;
      }

      case "reject": {
        if (cmd.taskId.startsWith("DEV-")) {
          const ok = rejectDevAction(cmd.taskId);
          await send(ok ? `Rejected DEV action ${cmd.taskId}.` : `No pending DEV action ${cmd.taskId}.`);
          ctx.status.record(`/reject ${cmd.taskId}`);
          return;
        }
        const n = bus.rejectTask(cmd.taskId);
        ctx.running.kill(cmd.taskId);
        await send(`Rejected ${n} pending step(s) for ${cmd.taskId}.`);
        ctx.status.record(`/reject ${cmd.taskId}`);
        return;
      }

      case "status": {
        const running = ctx.running
          .list()
          .filter((t) => !["completed", "failed", "killed"].includes(t.phase));
        const s = ctx.status.get();
        const pend = listPendingDevActions();
        await send(
          [
            `Last action: ${s.summary} @ ${s.updatedAt}`,
            running.length ? `Active: ${running.map((r) => `${r.taskId}:${r.phase}`).join(", ")}` : "No active pipelines.",
            pend.length ? `Pending DEV approvals: ${pend.map((p) => p.id).join(", ")}` : "No pending DEV approvals.",
          ].join("\n"),
        );
        return;
      }

      case "logs": {
        const p = ctx.ws.logFile(cmd.taskId);
        try {
          const raw = await fs.readFile(p, "utf8");
          const tail = raw.split("\n").slice(-40).join("\n");
          await send(tail || "(empty log)");
        } catch {
          await send(`No log for ${cmd.taskId}`);
        }
        return;
      }

      case "report": {
        const p = ctx.ws.reportFile(cmd.taskId, "agent");
        try {
          const raw = await fs.readFile(p, "utf8");
          await send(raw.slice(0, 3500) || "(no agent report yet)");
        } catch {
          await send(`No agent report for ${cmd.taskId}`);
        }
        return;
      }

      case "kill": {
        const ok = ctx.running.kill(cmd.taskId);
        bus.rejectTask(cmd.taskId);
        await send(ok ? `Kill signal sent for ${cmd.taskId}.` : `No runner for ${cmd.taskId}.`);
        return;
      }

      case "workspace": {
        const projects = await fs.readdir(ctx.ws.projectsDir()).catch(() => []);
        await send(
          [`Workspace: ${ctx.ws.root}`, `Tasks: ${ctx.ws.tasksDir()}`, `Projects:`, ...projects.map((p) => ` • ${p}`)].join(
            "\n",
          ),
        );
        return;
      }

      case "health": {
        const mem = process.memoryUsage();
        const llm = ctx.cfg.openaiApiKey
          ? `OpenAI: configured (${ctx.cfg.openaiModel ?? "default model"})`
          : "OpenAI: not configured";
        await send(
          [
            `devBOT health`,
            `- cwd: ${process.cwd()}`,
            `- workspace: ${ctx.ws.root}`,
            `- rss: ${Math.round(mem.rss / 1024 / 1024)} MB`,
            `- uptime: ${Math.round(process.uptime())}s`,
            `- hostname: ${os.hostname()}`,
            `- ${llm}`,
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
              await send(`Project ${cmd.name} (${cmd.type}) created under ${path.join(ctx.ws.projectsDir(), cmd.name)}`);
            } catch (e) {
              const m = e instanceof Error ? e.message : String(e);
              await send(`Create failed: ${m}`);
            }
          })();
        });
        await send(`Create queued. Approve with: /approve ${key}`);
        return;
      }

      case "unknown":
        await send(`Unknown: ${cmd.raw}`);
        ctx.status.record(`unknown: ${cmd.raw}`);
        return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await send(`Error: ${msg}`);
    ctx.status.record(`error: ${msg}`);
  }
}
