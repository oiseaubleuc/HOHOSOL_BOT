import { spawn } from "node:child_process";
import type { WorkspaceManager } from "../../workspace/workspaceManager.js";
import { assertArgvNotDangerous } from "../../security/dangerousArgv.js";

export interface SafeRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Runs a fixed argv with **no shell** and optional cwd constraint inside workspace.
 */
export async function runSafeArgv(
  ws: WorkspaceManager,
  cwd: string,
  argv: string[],
): Promise<SafeRunResult> {
  ws.assertPathInWorkspace(cwd);
  assertArgvNotDangerous(argv);
  const start = Date.now();
  return await new Promise((resolve) => {
    const child = spawn(argv[0]!, argv.slice(1), { cwd, env: process.env, shell: false });
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
        exitCode: null,
        stdout,
        stderr: stderr + String(err),
        durationMs: Date.now() - start,
      });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - start,
      });
    });
  });
}
