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
