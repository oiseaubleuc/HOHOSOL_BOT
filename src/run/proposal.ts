import { createHash } from "node:crypto";
import type { CommandStep, RunProposal } from "../types/commands.js";

function canonicalizeSteps(steps: CommandStep[]): string {
  const normalized = steps.map((s) => ({
    cwd: s.cwd,
    argv: s.argv,
    label: s.label,
  }));
  return JSON.stringify(normalized);
}

export function checksumForSteps(steps: CommandStep[]): string {
  return createHash("sha256").update(canonicalizeSteps(steps), "utf8").digest("hex");
}

export function buildRunProposal(input: {
  taskId: string;
  projectRoot: string;
  steps: CommandStep[];
  dryRun: boolean;
}): RunProposal {
  const checksum = checksumForSteps(input.steps);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    taskId: input.taskId,
    projectRoot: input.projectRoot,
    dryRun: input.dryRun,
    steps: input.steps,
    checksum,
  };
}

export function verifyProposalChecksum(proposal: RunProposal): boolean {
  return checksumForSteps(proposal.steps) === proposal.checksum;
}
