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

  const task = await loadTaskFromFile(taskPath);
  const { profile } = await detectProject(task.projectRoot);
  const botConfig = await loadBotConfig(profile.root);

  if (profile.flavor === "unknown") {
    console.error(
      `Could not classify project at ${profile.root}. Expected Laravel (artisan + laravel/framework) or Node (package.json).`,
    );
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
  } else if (approve) {
    results = await executeProposal(proposal, {
      flavor: profile.flavor,
      extraAllowedPrefixes: botConfig.extraAllowedPrefixes ?? [],
      approveChecksum: approve,
    });
    console.log("Executed allowlisted commands.");
  } else {
    console.log(
      "Commands not executed: pass --approve-checksum <sha256> from the proposal, or use --dry-run to silence this hint.",
    );
  }

  const report = formatLaravelChangeReport({
    task,
    profile,
    planMarkdown: planMd,
    results: dryRun ? undefined : results,
  });
  await writeTextFile(reportOut, report);
  console.log(`Wrote report: ${reportOut}`);
}

async function handleExecuteProposal(args: Record<string, string | boolean | string[]>): Promise<void> {
  const proposalPath = String(args.proposal ?? "");
  const approve = String(args["approve-checksum"] ?? "");
  if (!proposalPath || !approve) {
    console.error("execute-proposal requires --proposal <file.json> --approve-checksum <sha256>");
    process.exit(1);
  }
  const proposal = await readJsonFile<RunProposal>(path.resolve(proposalPath));
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
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
