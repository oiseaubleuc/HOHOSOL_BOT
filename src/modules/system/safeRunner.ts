import { runBounded } from "../../run/boundedSpawn.js";
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
  return await runBounded(argv, cwd);
}
