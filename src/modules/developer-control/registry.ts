import type { ActionType } from "./types.js";

export const ACTION_DESCRIPTIONS: Partial<Record<ActionType, string>> = {
  OPEN_CURSOR: "Open Cursor at a workspace project",
  OPEN_VSCODE: "Open Visual Studio Code at a workspace project",
  OPEN_TERMINAL: "Open Terminal.app pointed at a path",
  OPEN_FINDER: "Reveal folder in Finder",
  OPEN_BRAVE: "Launch Brave Browser",
  OPEN_BRAVE_URL: "Open a sanitized URL in Brave",
  INSTALL_DEPENDENCIES: "Install dependencies (npm/pnpm/yarn) inside a project",
  RUN_BUILD: "Run build script",
  RUN_TESTS: "Run test script or artisan test",
  RUN_LINT: "Run lint script",
  GIT_STATUS: "git status -sb",
  GIT_CREATE_BRANCH: "git checkout -b (requires approval)",
  GIT_COMMIT: "git commit -am (requires approval)",
  KILL_PORT: "SIGTERM listeners on a TCP port (requires approval)",
};
