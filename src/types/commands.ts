export interface CommandStep {
  argv: string[];
  cwd: string;
  label: string;
}

export interface RunProposal {
  version: 1;
  createdAt: string;
  taskId: string;
  projectRoot: string;
  dryRun: boolean;
  steps: CommandStep[];
  /**
   * sha256 of canonical payload (steps + cwd + argv), used for approval gating.
   */
  checksum: string;
}

export interface CommandResult {
  label: string;
  argv: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}
