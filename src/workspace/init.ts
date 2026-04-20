import { loadRuntimeConfig, resetRuntimeConfigForTests } from "../config/runtimeConfig.js";
import { ApprovalBus } from "../approvals/approvalBus.js";
import { TaskRegistry } from "../services/taskRegistry.js";
import { WorkspaceManager } from "./workspaceManager.js";
import { bootstrapDefaultWorkspaceContent } from "./bootstrapWorkspace.js";

export interface BotEnvironment {
  cfg: ReturnType<typeof loadRuntimeConfig>;
  ws: WorkspaceManager;
  registry: TaskRegistry;
}

let cache: BotEnvironment | undefined;

export async function getBotEnvironment(repoRoot = process.cwd()): Promise<BotEnvironment> {
  if (cache) return cache;
  const cfg = loadRuntimeConfig(repoRoot);
  const ws = new WorkspaceManager(cfg.workspacePath);
  await ws.ensureLayout();
  await bootstrapDefaultWorkspaceContent(ws, repoRoot);
  ApprovalBus.get().setAutoApprove(cfg.autoApprove);
  const registry = await TaskRegistry.load(ws.tasksDir());
  cache = { cfg, ws, registry };
  return cache;
}

export function resetBotEnvironmentForTests(): void {
  cache = undefined;
  ApprovalBus.resetForTests();
  resetRuntimeConfigForTests();
}
