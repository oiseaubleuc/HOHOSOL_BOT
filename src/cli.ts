#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { createDefaultNotifier } from "./modules/notifications/index.js";
import { executeProposalWorkflow, runTaskWorkflow } from "./services/taskRunWorkflow.js";
import { getBotEnvironment } from "./workspace/init.js";

function usage(): string {
  return [
    `devBOT — remote AI developer assistant`,
    ``,
    `Usage:`,
    `  ai-dev-bot run --task <path/to/task.json> [--dry-run] [--report-out <file.md>] [--proposal-out <file.json>] [--approve-checksum <sha256>]`,
    `  ai-dev-bot run-id <taskId>              — run task JSON from workspace/tasks/<id>.json`,
    `  ai-dev-bot execute-proposal --proposal <file> --approve-checksum <sha256>`,
    `  ai-dev-bot telegram                     — Telegram long-poll control`,
    `  ai-dev-bot whatsapp                     — WhatsApp command listener`,
    ``,
    `Workspace: all bot outputs + default tasks live under WORKSPACE_PATH (default ~/devbot-workspace).`,
    `See .env.example for OPENAI_API_KEY, GITHUB_*, TELEGRAM_*, WHATSAPP_*, DRY_RUN, AUTO_APPROVE.`,
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

async function handleRun(args: Record<string, string | boolean | string[]>): Promise<number> {
  const notify = createDefaultNotifier();
  const { ws } = await getBotEnvironment();

  const taskPath = String(args.task ?? "");
  if (!taskPath) {
    console.error("Missing --task <file.json>");
    return 1;
  }

  const dryRun = Boolean(args.dryRun);
  const approve = typeof args["approve-checksum"] === "string" ? String(args["approve-checksum"]) : "";
  const reportOut =
    typeof args["report-out"] === "string"
      ? String(args["report-out"])
      : ws.reportFile("cli-last", "report");
  const proposalOut =
    typeof args["proposal-out"] === "string"
      ? String(args["proposal-out"])
      : ws.proposalFile("cli-last");

  const res = await runTaskWorkflow({
    taskPath: path.resolve(taskPath),
    dryRun,
    approveChecksum: approve || undefined,
    proposalOut,
    reportOut,
    notifier: notify,
    workspace: ws,
  });

  if (res.proposalPath) console.log(`Wrote proposal: ${res.proposalPath}`);
  if (res.proposalChecksum) console.log(`Proposal checksum: ${res.proposalChecksum}`);
  if (dryRun) {
    console.log("Dry-run mode: subprocesses were not executed.");
  } else if (!approve) {
    console.log(
      "Commands not executed: pass --approve-checksum <sha256> from the proposal, or use --dry-run to silence this hint.",
    );
  } else if (res.results) {
    console.log("Executed allowlisted commands.");
  }
  if (res.reportPath) console.log(`Wrote report: ${res.reportPath}`);

  if (res.status === "unknown_project") return 2;
  if (res.status === "error") return 1;
  return 0;
}

async function handleRunById(taskId: string): Promise<number> {
  const { ws, registry } = await getBotEnvironment();
  await registry.refresh();
  const reg = registry.findById(taskId);
  if (!reg) {
    console.error(`Unknown task id: ${taskId} (look in ${ws.tasksDir()})`);
    return 1;
  }
  const args: Record<string, string | boolean | string[]> = {
    task: reg.filePath,
    dryRun: true,
    "report-out": ws.reportFile(taskId, "cli"),
    "proposal-out": ws.proposalFile(taskId),
  };
  return handleRun(args);
}

async function handleExecuteProposal(args: Record<string, string | boolean | string[]>): Promise<number> {
  const notify = createDefaultNotifier();
  const { ws } = await getBotEnvironment();
  const proposalPath = String(args.proposal ?? "");
  const approve = String(args["approve-checksum"] ?? "");
  if (!proposalPath || !approve) {
    console.error("execute-proposal requires --proposal <file.json> --approve-checksum <sha256>");
    return 1;
  }

  const res = await executeProposalWorkflow({
    proposalPath,
    approveChecksum: approve,
    notifier: notify,
    workspace: ws,
  });

  if (res.results) {
    for (const r of res.results) {
      console.log(`\n=== ${r.label} ===\n${r.stdout}\n${r.stderr}`.trim());
      console.log(`exit=${r.exitCode} durationMs=${r.durationMs}`);
    }
  }

  if (res.status === "error") return 1;
  return 0;
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
    process.exit(await handleRun(args));
  }
  if (cmd === "run-id") {
    const id = argv[1];
    if (!id) {
      console.error("Usage: ai-dev-bot run-id <taskId>");
      process.exit(1);
    }
    process.exit(await handleRunById(id));
  }
  if (cmd === "execute-proposal") {
    process.exit(await handleExecuteProposal(args));
  }
  if (cmd === "telegram") {
    const { startTelegramCommandListener } = await import("./modules/telegram/startTelegramListener.js");
    await startTelegramCommandListener(process.cwd());
    return;
  }
  if (cmd === "whatsapp") {
    const { startWhatsAppCommandListener } = await import("./modules/whatsapp/startWhatsAppListener.js");
    await startWhatsAppCommandListener(process.cwd());
    return;
  }

  console.error(`Unknown command: ${cmd ?? "(none)"}\n\n${usage()}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
