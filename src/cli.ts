#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { readJsonFile, writeTextFile } from "./fs/async.js";
import { detectProject } from "./detect/project.js";
import { loadBotConfig } from "./config/loadConfig.js";
import { loadTaskFromFile } from "./task/loadTask.js";
import { buildImplementationPlanMarkdown } from "./plan/planTask.js";
import { defaultLaravelInspectSteps } from "./run/laravelCommands.js";
import { defaultNodeInspectSteps } from "./plan/nodePlan.js";
import { buildRunProposal } from "./run/proposal.js";
import { executeProposal } from "./run/executor.js";
import { formatLaravelChangeReport } from "./report/laravelReport.js";
import type { CommandResult, RunProposal } from "./types/commands.js";
import type { TaskSpec } from "./types/task.js";
import { createDefaultNotifier } from "./modules/notifications/index.js";

function usage(): string {
  return [
    `ai-dev-bot — Laravel-first local dev assistant (MVP)`,
    ``,
    `Usage:`,
    `  ai-dev-bot run --task <path/to/task.json> [--dry-run] [--report-out <file.md>] [--proposal-out <file.json>] [--approve-checksum <sha256>]`,
    `  ai-dev-bot execute-proposal --proposal <file.json> --approve-checksum <sha256>`,
    ``,
    `Flags:`,
    `  --dry-run              Print plan + proposal; never executes subprocesses.`,
    `  --approve-checksum     Required to execute allowlisted commands (must match proposal checksum).`,
    ``,
    `Project config (optional, at repo root):`,
    `  ai-dev-bot.config.json  { "extraAllowedCommands": ["php|artisan|config:clear"] }`,
    ``,
    `Env (optional): see .env.example for Telegram notifications.`,
    ``,
  ].join("\n");
}

function parseArgs(argv: string[]): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
      continue;
    }
    positionals.push(a);
  }
  out._ = positionals;
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(usage());
    process.exit(0);
  }

  const cmd = argv[0];
  const cmdArgs = argv.slice(1);
  const args = parseArgs(cmdArgs);

  if (cmd === "run") {
    await handleRun(args);
    return;
  }
  if (cmd === "execute-proposal") {
    await handleExecuteProposal(args);
    return;
  }

  console.error(`Unknown command: ${cmd ?? "(none)"}\n\n${usage()}`);
  process.exit(1);
}

async function handleRun(args: Record<string, string | boolean | string[]>): Promise<void> {
  const notify = createDefaultNotifier();
  let task: TaskSpec | undefined;

  const taskPath = String(args.task ?? "");
  if (!taskPath) {
    console.error("Missing --task <file.json>");
    process.exit(1);
  }

  const dryRun = Boolean(args.dryRun);
  const approve = typeof args["approve-checksum"] === "string" ? String(args["approve-checksum"]) : "";
  const reportOut =
    typeof args["report-out"] === "string"
      ? String(args["report-out"])
      : path.join(process.cwd(), "reports", `last-report.md`);
  const proposalOut =
    typeof args["proposal-out"] === "string"
      ? String(args["proposal-out"])
      : path.join(process.cwd(), "proposals", `last.proposal.json`);

  try {
    task = await loadTaskFromFile(taskPath);
    await notify.notify({
      kind: "task_started",
      taskId: task.id,
      title: task.title,
      projectRoot: task.projectRoot,
      mode: "run",
    });

    const { profile } = await detectProject(task.projectRoot);
    const botConfig = await loadBotConfig(profile.root);

    if (profile.flavor === "unknown") {
      const err =
        `Could not classify project at ${profile.root}. Expected Laravel (artisan + laravel/framework) or Node (package.json).`;
      console.error(err);
      await notify.notify({
        kind: "task_failed",
        taskId: task.id,
        title: task.title,
        error: err,
      });
      process.exit(2);
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
      dryRun,
    });

    await writeTextFile(proposalOut, JSON.stringify(proposal, null, 2));
    console.log(`Wrote proposal: ${proposalOut}`);
    console.log(`Proposal checksum: ${proposal.checksum}`);

    let results: CommandResult[] | undefined;

    if (dryRun) {
      console.log("Dry-run mode: subprocesses were not executed.");
      await notify.notify({
        kind: "task_requires_approval",
        taskId: task.id,
        title: task.title,
        checksum: proposal.checksum,
        proposalPath: proposalOut,
        dryRun: true,
      });
    } else if (!approve) {
      console.log(
        "Commands not executed: pass --approve-checksum <sha256> from the proposal, or use --dry-run to silence this hint.",
      );
      await notify.notify({
        kind: "task_requires_approval",
        taskId: task.id,
        title: task.title,
        checksum: proposal.checksum,
        proposalPath: proposalOut,
        dryRun: false,
      });
    } else {
      results = await executeProposal(proposal, {
        flavor: profile.flavor,
        extraAllowedPrefixes: botConfig.extraAllowedPrefixes ?? [],
        approveChecksum: approve,
      });
      console.log("Executed allowlisted commands.");
    }

    const report = formatLaravelChangeReport({
      task,
      profile,
      planMarkdown: planMd,
      results: dryRun ? undefined : results,
    });
    await writeTextFile(reportOut, report);
    console.log(`Wrote report: ${reportOut}`);

    if (!dryRun && approve && results) {
      const failed = results.find((r) => r.exitCode !== 0);
      if (failed) {
        await notify.notify({
          kind: "task_failed",
          taskId: task.id,
          title: task.title,
          error: `Command "${failed.label}" exited with code ${String(failed.exitCode)}.`,
        });
      } else {
        await notify.notify({
          kind: "task_completed",
          taskId: task.id,
          title: task.title,
          reportPath: reportOut,
          summary: `Inspect commands finished OK. Report: ${reportOut}`,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notify.notify({
      kind: "task_failed",
      taskId: task?.id ?? "unknown",
      title: task?.title ?? "unknown",
      error: msg,
    });
    throw err;
  }
}

async function handleExecuteProposal(args: Record<string, string | boolean | string[]>): Promise<void> {
  const notify = createDefaultNotifier();
  const proposalPath = String(args.proposal ?? "");
  const approve = String(args["approve-checksum"] ?? "");
  if (!proposalPath || !approve) {
    console.error("execute-proposal requires --proposal <file.json> --approve-checksum <sha256>");
    process.exit(1);
  }

  let proposal: RunProposal | undefined;
  try {
    proposal = await readJsonFile<RunProposal>(path.resolve(proposalPath));
    await notify.notify({
      kind: "task_started",
      taskId: proposal.taskId,
      title: "execute-proposal",
      projectRoot: proposal.projectRoot,
      mode: "execute-proposal",
    });

    const { profile } = await detectProject(proposal.projectRoot);
    const botConfig = await loadBotConfig(profile.root);
    const results = await executeProposal(proposal, {
      flavor: profile.flavor,
      extraAllowedPrefixes: botConfig.extraAllowedPrefixes ?? [],
      approveChecksum: approve,
    });
    for (const r of results) {
      console.log(`\n=== ${r.label} ===\n${r.stdout}\n${r.stderr}`.trim());
      console.log(`exit=${r.exitCode} durationMs=${r.durationMs}`);
    }

    const failed = results.find((r) => r.exitCode !== 0);
    if (failed) {
      await notify.notify({
        kind: "task_failed",
        taskId: proposal.taskId,
        title: "execute-proposal",
        error: `Command "${failed.label}" exited with code ${String(failed.exitCode)}.`,
      });
    } else {
      await notify.notify({
        kind: "task_completed",
        taskId: proposal.taskId,
        title: "execute-proposal",
        summary: "Proposal executed; all commands exited 0.",
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notify.notify({
      kind: "task_failed",
      taskId: proposal?.taskId ?? "unknown",
      title: "execute-proposal",
      error: msg,
    });
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
