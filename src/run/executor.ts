import { spawn } from "node:child_process";
import type { CommandResult, CommandStep, RunProposal } from "../types/commands.js";
import type { ProjectFlavor } from "../types/project.js";
import { assertCommandsAllowed } from "./allowlist.js";
import { verifyProposalChecksum } from "./proposal.js";
import { assertArgvNotDangerous } from "../security/dangerousArgv.js";

export interface ExecuteOptions {
  flavor: ProjectFlavor;
  extraAllowedPrefixes: string[][];
  approveChecksum: string;
  /** When set, each step cwd must stay inside the workspace root. */
  assertCwdInWorkspace?: (cwd: string) => void;
}

export async function executeProposal(proposal: RunProposal, opts: ExecuteOptions): Promise<CommandResult[]> {
  if (!verifyProposalChecksum(proposal)) {
    throw new Error("Proposal checksum mismatch; refusing to execute.");
  }
  if (opts.approveChecksum !== proposal.checksum) {
    throw new Error(
      "Approval missing or incorrect. Re-run with the checksum printed during dry-run: --approve-checksum <sha256>",
    );
  }

  assertCommandsAllowed(
    opts.flavor === "unknown" ? "unknown" : opts.flavor,
    proposal.steps,
    opts.extraAllowedPrefixes,
  );

  const results: CommandResult[] = [];
  for (const step of proposal.steps) {
    assertArgvNotDangerous(step.argv);
    opts.assertCwdInWorkspace?.(step.cwd);
    results.push(await runStep(step));
  }
  return results;
}

function runStep(step: CommandStep): Promise<CommandResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.argv[0]!, step.argv.slice(1), {
      cwd: step.cwd,
      env: process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr?.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => {
      resolve({
        label: step.label,
        argv: step.argv,
        exitCode: null,
        stdout,
        stderr: stderr + String(err),
        durationMs: Date.now() - start,
      });
    });
    child.on("close", (code) => {
      resolve({
        label: step.label,
        argv: step.argv,
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });
}
