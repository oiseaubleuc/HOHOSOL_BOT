import { writeTextFile } from "../fs/async.js";
import { ApprovalBus } from "../approvals/approvalBus.js";
import type { RuntimeConfig } from "../config/runtimeConfig.js";
import { coachFailure } from "../ai/openAiCoach.js";
import { appendTaskMemory } from "../memory/taskMemory.js";
import { TaskLog } from "../logging/taskLog.js";
import { buildAgentMarkdownReport } from "../reports/agentReport.js";
import { runTaskWorkflow } from "../services/taskRunWorkflow.js";
import type { WorkspaceManager } from "../workspace/workspaceManager.js";
import type { RunningTaskRegistry } from "../state/runningTasks.js";

export interface AgentPipelineDeps {
  ws: WorkspaceManager;
  cfg: RuntimeConfig;
  running: RunningTaskRegistry;
  bus: ApprovalBus;
}

/**
 * Remote-friendly pipeline: approvals gate writes/execution; logs + memory + markdown report.
 */
export async function runAgentPipeline(
  taskId: string,
  taskPath: string,
  title: string,
  deps: AgentPipelineDeps,
): Promise<void> {
  const { ws, cfg, running, bus } = deps;
  const logPath = ws.logFile(taskId);
  const log = new TaskLog(logPath);
  running.start(taskId, logPath);
  const reasoning: string[] = [];
  const phases: string[] = [];
  const signal = running.signal(taskId);

  const fail = async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    await log.line("ERROR", "Pipeline failed", { message: msg });
    await appendTaskMemory(ws, taskId, { phase: "failed", note: msg }, { lastError: msg });
    running.finish(taskId, "failed", msg);
  };

  try {
    await log.line("INFO", "Pipeline started", { taskId, taskPath });
    reasoning.push("Loaded task and validated workspace paths.");
    phases.push("analyze");

    if (cfg.dryRun) {
      await log.line("INFO", "Global DRY_RUN=true — shell execution steps will be skipped after plan.");
    }

    await bus.wait(taskId, "Approve writing proposal + dry-run report under workspace");
    if (signal?.aborted) throw new Error("aborted");
    running.update(taskId, { phase: "planning" });
    phases.push("plan_write");

    const dry = await runTaskWorkflow({
      taskPath,
      dryRun: true,
      proposalOut: ws.proposalFile(taskId),
      reportOut: ws.reportFile(taskId, "dry-run"),
      notifier: null,
      workspace: ws,
    });

    await appendTaskMemory(ws, taskId, { phase: "dry_run", note: `status=${dry.status}` });
    if (dry.status !== "ok") {
      const coach = await coachFailure({
        apiKey: cfg.openaiApiKey,
        taskTitle: title,
        errorText: dry.error ?? dry.status,
      });
      await appendTaskMemory(ws, taskId, { phase: "coach", note: coach ?? "(no coach)" }, { suggestions: coach ? [coach] : [] });
      const reportMd = buildAgentMarkdownReport({
        taskId,
        title,
        phases,
        dryRunResult: dry,
        coachNote: coach,
        reasoning,
      });
      await writeTextFile(ws.reportFile(taskId, "agent"), reportMd);
      running.finish(taskId, "failed", dry.error);
      return;
    }

    reasoning.push(`Dry-run checksum ${dry.proposalChecksum ?? "(n/a)"} — awaiting execution approval.`);
    running.update(taskId, { phase: "awaiting_approval_execute" });
    phases.push("await_execute");

    if (cfg.dryRun) {
      await log.line("INFO", "Skipping execute due to DRY_RUN=true");
      const reportMd = buildAgentMarkdownReport({
        taskId,
        title,
        phases,
        dryRunResult: dry,
        reasoning: [...reasoning, "Stopped before shell execution because DRY_RUN=true."],
      });
      await writeTextFile(ws.reportFile(taskId, "agent"), reportMd);
      running.finish(taskId, "completed");
      return;
    }

    await bus.wait(taskId, "Approve running allowlisted inspect commands");
    if (signal?.aborted) throw new Error("aborted");
    running.update(taskId, { phase: "running_commands" });

    const exec = await runTaskWorkflow({
      taskPath,
      dryRun: false,
      approveChecksum: dry.proposalChecksum,
      proposalOut: ws.proposalFile(taskId),
      reportOut: ws.reportFile(taskId, "executed"),
      notifier: null,
      workspace: ws,
    });

    await appendTaskMemory(ws, taskId, { phase: "execute", note: `status=${exec.status}` });

    let coach: string | undefined;
    if (exec.commandFailed) {
      const errText = exec.results?.map((r) => `${r.label}: exit ${r.exitCode}\n${r.stderr}`).join("\n") ?? "command failed";
      coach = await coachFailure({ apiKey: cfg.openaiApiKey, taskTitle: title, errorText: errText });
      await appendTaskMemory(ws, taskId, { phase: "coach", note: coach ?? "" }, { suggestions: coach ? [coach] : [] });
      reasoning.push("Commands failed — requested AI coach notes for remediation.");
    } else {
      reasoning.push("Commands completed with exit code 0.");
    }

    phases.push("report");
    const reportMd = buildAgentMarkdownReport({
      taskId,
      title,
      phases,
      dryRunResult: dry,
      executeResult: exec,
      coachNote: coach,
      reasoning,
    });
    await writeTextFile(ws.reportFile(taskId, "agent"), reportMd);
    await log.line("INFO", "Pipeline completed", { report: ws.reportFile(taskId, "agent") });
    running.finish(taskId, exec.commandFailed ? "failed" : "completed", exec.commandFailed ? "command_failed" : undefined);
  } catch (e) {
    await fail(e);
  }
}
