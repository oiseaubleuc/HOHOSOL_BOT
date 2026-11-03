import { spawn } from "node:child_process";
import { childEnv } from "../security/childEnv.js";

export const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const KILL_GRACE_MS = 5000;
const MAX_OUTPUT_CHARS = 1_000_000;

export interface BoundedResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Runs argv with **no shell**, a filtered environment, no stdin, capped output and a timeout
 * that kills the whole process group.
 */
export function runBounded(argv: string[], cwd: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<BoundedResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd,
      env: childEnv(),
      shell: false,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let grace: NodeJS.Timeout | undefined;
    child.stdout.on("data", (d) => {
      if (stdout.length < MAX_OUTPUT_CHARS) stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < MAX_OUTPUT_CHARS) stderr += String(d);
    });
    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      clearTimeout(grace);
      resolve({ exitCode, stdout, stderr, durationMs: Date.now() - start });
    };
    const killGroup = (signal: NodeJS.Signals) => {
      try {
        process.kill(-child.pid!, signal);
      } catch {
        // Group already gone.
      }
    };
    const timer = setTimeout(() => {
      stderr += `\nTimed out after ${Math.round(timeoutMs / 1000)}s`;
      killGroup("SIGTERM");
      // A process that left the group can hold the pipes open: never wait for "close" forever.
      grace = setTimeout(() => {
        killGroup("SIGKILL");
        child.stdout.destroy();
        child.stderr.destroy();
        finish(null);
      }, KILL_GRACE_MS);
    }, timeoutMs);
    child.on("error", (err) => {
      stderr += String(err);
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}
