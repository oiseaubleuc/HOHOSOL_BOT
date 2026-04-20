import path from "node:path";
import { readJsonFile, writeTextFile } from "../fs/async.js";
import { detectProject } from "../detect/project.js";
import { loadBotConfig } from "../config/loadConfig.js";
import { loadTaskFromFile } from "../task/loadTask.js";
import { buildImplementationPlanMarkdown } from "../plan/planTask.js";
import { defaultLaravelInspectSteps } from "../run/laravelCommands.js";
import { defaultNodeInspectSteps } from "../plan/nodePlan.js";
import { buildRunProposal } from "../run/proposal.js";
import { executeProposal } from "../run/executor.js";
import { formatLaravelChangeReport } from "../report/laravelReport.js";
import type { CommandResult, RunProposal } from "../types/commands.js";
import type { Notifier } from "../modules/notifications/types.js";
import type { WorkspaceManager } from "../workspace/workspaceManager.js";

export type TaskRunWorkflowStatus = "ok" | "error" | "unknown_project";

export interface TaskRunWorkflowOptions {
  taskPath: string;
  dryRun: boolean;
  /** When set with dryRun false, allowlisted commands are executed after checksum verification. */
  approveChecksum?: string;
  proposalOut: string;
  reportOut: string;
  /** When null, lifecycle notifications are skipped (e.g. Telegram bot replies instead). */
  notifier: Notifier | null;
  /** When set, all paths touched must remain inside the workspace root. */
  workspace?: WorkspaceManager;
}

export interface TaskRunWorkflowResult {
  status: TaskRunWorkflowStatus;
  taskId?: string;
  title?: string;
  error?: string;
  proposalChecksum?: string;
  proposalPath?: string;
  reportPath?: string;
  /** Present when approve path ran */
  results?: CommandResult[];
  /** True when at least one approved command exited non-zero */
  commandFailed?: boolean;
}

async function notifySafe(notifier: Notifier | null, fn: (n: Notifier) => Promise<void>): Promise<void> {
  if (!notifier) return;
  await fn(notifier);
}

/**
 * Shared pipeline for `run` CLI and Telegram `/run` + `/approve`.
 */
export async function runTaskWorkflow(opts: TaskRunWorkflowOptions): Promise<TaskRunWorkflowResult> {
  let taskContext: { id: string; title: string } | undefined;
  try {
    const task = await loadTaskFromFile(opts.taskPath);
    taskContext = { id: task.id, title: task.title };
    opts.workspace?.assertPathInWorkspace(task.projectRoot);
    opts.workspace?.assertPathInWorkspace(opts.proposalOut);
    opts.workspace?.assertPathInWorkspace(opts.reportOut);

    await notifySafe(opts.notifier, (n) =>
      n.notify({
        kind: "task_started",
        taskId: task.id,
        title: task.title,
        projectRoot: task.projectRoot,
        mode: "run",
      }),
    );

    const { profile } = await detectProject(task.projectRoot);
    const botConfig = await loadBotConfig(profile.root);

    if (profile.flavor === "unknown") {
      const err =
        `Could not classify project at ${profile.root}. Expected Laravel (artisan + laravel/framework) or Node (package.json).`;
      await notifySafe(opts.notifier, (n) =>
        n.notify({ kind: "task_failed", taskId: task.id, title: task.title, error: err }),
      );
      return { status: "unknown_project", taskId: task.id, title: task.title, error: err };
    }

    const planMd = buildImplementationPlanMarkdown(task, profile);

    const steps =
      profile.flavor === "laravel"
        ? defaultLaravelInspectSteps(profile.root)
        : profile.flavor === "node" && profile.node
          ? defaultNodeInspectSteps(profile.root, profile.node)
          : [];

    const proposal = buildRunProposal({
      taskId: task.id,
      projectRoot: profile.root,
      steps,
      dryRun: opts.dryRun,
    });

    await writeTextFile(opts.proposalOut, JSON.stringify(proposal, null, 2));

    const approve = opts.approveChecksum?.trim() ?? "";
    let results: CommandResult[] | undefined;

    if (opts.dryRun) {
      await notifySafe(opts.notifier, (n) =>
        n.notify({
          kind: "task_requires_approval",
          taskId: task.id,
          title: task.title,
          checksum: proposal.checksum,
          proposalPath: opts.proposalOut,
          dryRun: true,
        }),
      );
    } else if (!approve) {
      await notifySafe(opts.notifier, (n) =>
        n.notify({
          kind: "task_requires_approval",
          taskId: task.id,
          title: task.title,
          checksum: proposal.checksum,
          proposalPath: opts.proposalOut,
          dryRun: false,
        }),
      );
    } else {
      results = await executeProposal(proposal, {
        flavor: profile.flavor,
        extraAllowedPrefixes: botConfig.extraAllowedPrefixes ?? [],
        approveChecksum: approve,
        assertCwdInWorkspace: opts.workspace
          ? (cwd) => opts.workspace!.assertPathInWorkspace(cwd)
          : undefined,
      });
    }

    const report = formatLaravelChangeReport({
      task,
      profile,
      planMarkdown: planMd,
      results: opts.dryRun ? undefined : results,
    });
    await writeTextFile(opts.reportOut, report);

    if (!opts.dryRun && approve && results) {
      const failed = results.find((r) => r.exitCode !== 0);
      if (failed) {
        await notifySafe(opts.notifier, (n) =>
          n.notify({
            kind: "task_failed",
            taskId: task.id,
            title: task.title,
            error: `Command "${failed.label}" exited with code ${String(failed.exitCode)}.`,
          }),
        );
        return {
          status: "ok",
          taskId: task.id,
          title: task.title,
          proposalChecksum: proposal.checksum,
          proposalPath: opts.proposalOut,
          reportPath: opts.reportOut,
          results,
          commandFailed: true,
        };
      }
      await notifySafe(opts.notifier, (n) =>
        n.notify({
          kind: "task_completed",
          taskId: task.id,
          title: task.title,
          reportPath: opts.reportOut,
          summary: `Inspect commands finished OK. Report: ${opts.reportOut}`,
        }),
      );
    }

    return {
      status: "ok",
      taskId: task.id,
      title: task.title,
      proposalChecksum: proposal.checksum,
      proposalPath: opts.proposalOut,
      reportPath: opts.reportOut,
      results,
      commandFailed: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifySafe(opts.notifier, (n) =>
      n.notify({
        kind: "task_failed",
        taskId: taskContext?.id ?? "unknown",
        title: taskContext?.title ?? "unknown",
        error: msg,
      }),
    );
    return { status: "error", taskId: taskContext?.id, title: taskContext?.title, error: msg };
  }
}

export interface ExecuteProposalWorkflowOptions {
  proposalPath: string;
  approveChecksum: string;
  notifier: Notifier | null;
  workspace?: WorkspaceManager;
}

export interface ExecuteProposalWorkflowResult {
  status: TaskRunWorkflowStatus;
  taskId?: string;
  error?: string;
  results?: CommandResult[];
  commandFailed?: boolean;
}

export async function executeProposalWorkflow(
  opts: ExecuteProposalWorkflowOptions,
): Promise<ExecuteProposalWorkflowResult> {
  let proposalTaskId: string | undefined;
  try {
    const proposal = await readJsonFile<RunProposal>(path.resolve(opts.proposalPath));
    proposalTaskId = proposal.taskId;
    opts.workspace?.assertPathInWorkspace(proposal.projectRoot);
    opts.workspace?.assertPathInWorkspace(path.resolve(opts.proposalPath));

    await notifySafe(opts.notifier, (n) =>
      n.notify({
        kind: "task_started",
        taskId: proposal.taskId,
        title: "execute-proposal",
        projectRoot: proposal.projectRoot,
        mode: "execute-proposal",
      }),
    );

    const { profile } = await detectProject(proposal.projectRoot);
    const botConfig = await loadBotConfig(profile.root);
    const results = await executeProposal(proposal, {
      flavor: profile.flavor,
      extraAllowedPrefixes: botConfig.extraAllowedPrefixes ?? [],
      approveChecksum: opts.approveChecksum,
      assertCwdInWorkspace: opts.workspace
        ? (cwd) => opts.workspace!.assertPathInWorkspace(cwd)
        : undefined,
    });

    const failed = results.find((r) => r.exitCode !== 0);
    if (failed) {
      await notifySafe(opts.notifier, (n) =>
        n.notify({
          kind: "task_failed",
          taskId: proposal.taskId,
          title: "execute-proposal",
          error: `Command "${failed.label}" exited with code ${String(failed.exitCode)}.`,
        }),
      );
      return { status: "ok", taskId: proposal.taskId, results, commandFailed: true };
    }

    await notifySafe(opts.notifier, (n) =>
      n.notify({
        kind: "task_completed",
        taskId: proposal.taskId,
        title: "execute-proposal",
        summary: "Proposal executed; all commands exited 0.",
      }),
    );
    return { status: "ok", taskId: proposal.taskId, results, commandFailed: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifySafe(opts.notifier, (n) =>
      n.notify({
        kind: "task_failed",
        taskId: proposalTaskId ?? "unknown",
        title: "execute-proposal",
        error: msg,
      }),
    );
    return { status: "error", taskId: proposalTaskId, error: msg };
  }
}
