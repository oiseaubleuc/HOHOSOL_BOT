import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { ParsedTelegramCommand } from "./types.js";
import type { TelegramClient } from "./telegramClient.js";
import { TaskRegistry } from "../../services/taskRegistry.js";
import { StatusService } from "../../services/statusService.js";
import { ApprovalBus } from "../../approvals/approvalBus.js";
import { RunningTaskRegistry } from "../../state/runningTasks.js";
import { runAgentPipeline } from "../../execution/agentPipeline.js";
import { createScaffoldedProject } from "../../projects/projectCreator.js";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import type { RuntimeConfig } from "../../config/runtimeConfig.js";

export interface TelegramBotContext {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  client: TelegramClient;
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
        const ok = bus.approveNext(cmd.taskId);
        await send(ok ? `Approved next step for ${cmd.taskId}.` : `No pending approval for ${cmd.taskId}.`);
        ctx.status.record(`/approve ${cmd.taskId}`);
        return;
      }

      case "reject": {
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
        await send(
          [
            `Last action: ${s.summary} @ ${s.updatedAt}`,
            running.length ? `Active: ${running.map((r) => `${r.taskId}:${r.phase}`).join(", ")}` : "No active pipelines.",
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
        await send(
          [
            `devBOT health`,
            `- cwd: ${process.cwd()}`,
            `- workspace: ${ctx.ws.root}`,
            `- rss: ${Math.round(mem.rss / 1024 / 1024)} MB`,
            `- uptime: ${Math.round(process.uptime())}s`,
            `- hostname: ${os.hostname()}`,
          ].join("\n"),
        );
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
