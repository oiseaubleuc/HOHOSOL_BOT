export type { TaskSpec, RawTaskJson, TaskAcceptanceCriterion, TaskFileHint } from "./types/task.js";
export type { ProjectProfile, ProjectFlavor, LaravelLayout, NodeLayout, BotConfig } from "./types/project.js";
export type { RunProposal, CommandStep, CommandResult } from "./types/commands.js";

export { detectProject } from "./detect/project.js";
export { isLaravelProject, resolveLaravelLayout } from "./detect/laravel.js";
export { isNodeProject, resolveNodeLayout } from "./detect/node.js";

export { loadTaskFromFile } from "./task/loadTask.js";
export { loadBotConfig } from "./config/loadConfig.js";

export { buildImplementationPlanMarkdown } from "./plan/planTask.js";
export { suggestLaravelTouchPoints, laravelImplementationPlanMarkdown } from "./plan/laravelConventions.js";
export { defaultNodeInspectSteps, nodeDiscoveryMarkdown } from "./plan/nodePlan.js";

export { defaultLaravelInspectSteps } from "./run/laravelCommands.js";
export { buildRunProposal, checksumForSteps, verifyProposalChecksum } from "./run/proposal.js";
export { executeProposal } from "./run/executor.js";
export {
  isLaravelArgvAllowed,
  isNodeArgvAllowed,
  assertCommandsAllowed,
  parseExtraAllowedSignatures,
} from "./run/allowlist.js";

export { formatLaravelChangeReport } from "./report/laravelReport.js";

export {
  createDefaultNotifier,
  ConsoleNotifier,
  TelegramNotifier,
  truncateForTelegram,
} from "./modules/notifications/index.js";
export type { Notifier, NotificationPayload } from "./modules/notifications/types.js";

export { runTaskWorkflow, executeProposalWorkflow } from "./services/taskRunWorkflow.js";
export { TaskRegistry, resolveTasksDir } from "./services/taskRegistry.js";
export { StatusService } from "./services/statusService.js";

export { startTelegramCommandListener, parseTelegramCommand, TelegramClient } from "./modules/telegram/index.js";
export type { ParsedTelegramCommand } from "./modules/telegram/types.js";

export { loadRuntimeConfig, resetRuntimeConfigForTests } from "./config/runtimeConfig.js";
export type { RuntimeConfig } from "./config/runtimeConfig.js";
export { WorkspaceManager } from "./workspace/workspaceManager.js";
export { getBotEnvironment, resetBotEnvironmentForTests } from "./workspace/init.js";
export { ApprovalBus } from "./approvals/approvalBus.js";
export { runAgentPipeline } from "./execution/agentPipeline.js";
export { createScaffoldedProject } from "./projects/projectCreator.js";
export type { ScaffoldType } from "./types/scaffold.js";
