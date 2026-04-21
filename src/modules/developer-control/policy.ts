import type { ActionType, PolicyDecision } from "./types.js";

const APPROVAL: ActionType[] = [
  "INSTALL_DEPENDENCIES",
  "RUN_DEV_SERVER",
  "WRITE_FILE",
  "APPLY_PATCH",
  "GIT_CREATE_BRANCH",
  "GIT_COMMIT",
  "GIT_PUSH",
  "KILL_PORT",
];

const DENY: ActionType[] = [];

export function policyForAction(type: ActionType): PolicyDecision {
  if (DENY.includes(type)) return "deny";
  if (APPROVAL.includes(type)) return "requires_approval";
  return "allow";
}
