import path from "node:path";
import type { ParsedTelegramCommand } from "./types.js";
import type { TelegramClient } from "./telegramClient.js";
import { TaskRegistry, resolveTasksDir } from "../../services/taskRegistry.js";
import { PendingApprovalStore } from "../../services/pendingApprovalStore.js";
import { StatusService } from "../../services/statusService.js";
import { runTaskWorkflow } from "../../services/taskRunWorkflow.js";

export interface TelegramCommandContext {
  cwd: string;
  client: TelegramClient;
  chatId: number;
  registry: TaskRegistry;
  pending: PendingApprovalStore;
  status: StatusService;
}

export async function dispatchTelegramCommand(
  cmd: ParsedTelegramCommand,
  ctx: TelegramCommandContext,
): Promise<void> {
  const send = (text: string) => ctx.client.sendMessage(ctx.chatId, text);

  try {
    switch (cmd.kind) {
      case "start":
        await send(
          [
            "devBOT — commands:",
            "/tasks — list task ids",
            "/run <taskId> — dry-run + save proposal (needs /approve next)",
            "/approve <taskId> — execute last proposal for that task",
            "/status — last action summary",
          ].join("\n"),
        );
        ctx.status.record("/start");
        return;

      case "tasks": {
        await ctx.registry.refresh();
        const tasks = ctx.registry.list();
        if (tasks.length === 0) {
          await send(`No tasks found in ${resolveTasksDir(ctx.cwd)}`);
        } else {
          await send(
            "Tasks:\n" +
              tasks.map((t) => `• ${t.id} — ${t.title}\n  ${t.filePath}`).join("\n"),
          );
        }
        ctx.status.record("/tasks");
        return;
      }

      case "run": {
        await ctx.registry.refresh();
        const reg = ctx.registry.findById(cmd.taskId);
        if (!reg) {
          await send(`Unknown task id: ${cmd.taskId}. Try /tasks.`);
          ctx.status.record(`/run ${cmd.taskId} (missing)`);
          return;
        }
        const proposalOut = path.join(ctx.cwd, "proposals", `${reg.id}.proposal.json`);
        const reportOut = path.join(ctx.cwd, "reports", `${reg.id}-dry-run.md`);
        const res = await runTaskWorkflow({
          taskPath: reg.filePath,
          dryRun: true,
          proposalOut,
          reportOut,
          notifier: null,
        });
        if (res.status !== "ok") {
          await send(`Run failed (${cmd.taskId}): ${res.error ?? res.status}`);
          ctx.status.record(`/run ${cmd.taskId} failed`);
          return;
        }
        ctx.pending.set({
          taskId: reg.id,
          taskPath: reg.filePath,
          proposalPath: proposalOut,
          reportPath: path.join(ctx.cwd, "reports", `${reg.id}-approved.md`),
          checksum: res.proposalChecksum ?? "",
          updatedAt: new Date().toISOString(),
        });
        await send(
          [
            `Dry-run done for ${reg.id}.`,
            `Checksum: ${res.proposalChecksum}`,
            `Proposal: ${proposalOut}`,
            `Report: ${res.reportPath}`,
            "",
            `Approve with: /approve ${reg.id}`,
          ].join("\n"),
        );
        ctx.status.record(`/run ${cmd.taskId} ok`);
        return;
      }

      case "approve": {
        const pending = ctx.pending.get(cmd.taskId);
        if (!pending) {
          await send(`No pending proposal for ${cmd.taskId}. Run /run ${cmd.taskId} first.`);
          ctx.status.record(`/approve ${cmd.taskId} (no pending)`);
          return;
        }
        const res = await runTaskWorkflow({
          taskPath: pending.taskPath,
          dryRun: false,
          approveChecksum: pending.checksum,
          proposalOut: pending.proposalPath,
          reportOut: pending.reportPath,
          notifier: null,
        });
        if (res.status !== "ok") {
          await send(`Approve failed (${cmd.taskId}): ${res.error ?? res.status}`);
          ctx.status.record(`/approve ${cmd.taskId} failed`);
          return;
        }
        if (res.commandFailed) {
          await send(`Commands finished with errors for ${cmd.taskId}. See report: ${res.reportPath}`);
          ctx.pending.clear(cmd.taskId);
          ctx.status.record(`/approve ${cmd.taskId} commandFailed`);
          return;
        }
        await send(`Approved run finished for ${cmd.taskId}.\nReport: ${res.reportPath}`);
        ctx.pending.clear(cmd.taskId);
        ctx.status.record(`/approve ${cmd.taskId} ok`);
        return;
      }

      case "status": {
        const s = ctx.status.get();
        await send(`Status (${s.updatedAt}):\n${s.summary}`);
        return;
      }

      case "unknown":
        await send(`Unknown command: ${cmd.raw}`);
        ctx.status.record(`unknown: ${cmd.raw}`);
        return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await send(`Error: ${msg}`);
    ctx.status.record(`error: ${msg}`);
  }
}
