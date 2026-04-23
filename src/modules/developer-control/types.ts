export type PolicyDecision = "allow" | "deny" | "requires_approval";

export type ActionType =
  | "OPEN_CURSOR"
  | "OPEN_VSCODE"
  | "OPEN_TERMINAL"
  | "OPEN_FINDER"
  | "OPEN_BRAVE"
  | "OPEN_BRAVE_URL"
  | "OPEN_SAFARI_URL"
  | "LIST_PROJECTS"
  | "OPEN_PROJECT"
  | "INSPECT_PROJECT"
  | "INSTALL_DEPENDENCIES"
  | "RUN_DEV_SERVER"
  | "RUN_BUILD"
  | "RUN_TESTS"
  | "RUN_LINT"
  | "GIT_STATUS"
  | "GIT_DIFF"
  | "GIT_CREATE_BRANCH"
  | "GIT_COMMIT"
  | "GIT_PUSH"
  | "READ_FILE"
  | "LIST_FILES"
  | "WRITE_FILE"
  | "APPLY_PATCH"
  | "LIST_PORTS"
  | "LIST_PROCESSES"
  | "KILL_PORT"
  | "CREATE_FOLDER"
  | "OPEN_MAC_APP";

export interface ActionResult {
  success: boolean;
  actionType: ActionType | string;
  summary: string;
  details?: string;
  requiresApproval?: boolean;
  output?: string;
  error?: string;
}

export interface ActionContext {
  workspaceRoot: string;
  projectRoot?: string;
  projectName?: string;
}
