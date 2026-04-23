import type { ActionResult } from "../developer-control/types.js";

/** Leave headroom under Telegram’s 4096 limit. */
export const TELEGRAM_SAFE_MAX = 3900;

export function truncateTelegram(text: string, max = TELEGRAM_SAFE_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 40)}\n… (${text.length - max + 40} chars trimmed)`;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_FOLDER: "Desktop folder",
  INSTALL_DEPENDENCIES: "Install deps",
  GIT_COMMIT: "Git commit",
  GIT_PUSH: "Git push",
  GIT_CREATE_BRANCH: "Git branch",
  KILL_PORT: "Kill port",
  RUN_DEV_SERVER: "Dev server",
  INSPECT_PROJECT: "Inspect",
  OPEN_CURSOR: "Cursor",
  OPEN_VSCODE: "VS Code",
  OPEN_TERMINAL: "Terminal",
  OPEN_FINDER: "Finder",
  OPEN_BRAVE: "Brave",
  OPEN_MAC_APP: "App Mac",
  OPEN_BRAVE_URL: "Brave URL",
  OPEN_SAFARI_URL: "Safari URL",
  LIST_PROJECTS: "Projects",
  OPEN_PROJECT: "Open project",
  RUN_BUILD: "Build",
  RUN_TESTS: "Tests",
  RUN_LINT: "Lint",
  GIT_STATUS: "Git status",
  GIT_DIFF: "Git diff",
  READ_FILE: "Read file",
  LIST_FILES: "List files",
  LIST_PORTS: "Ports",
  LIST_PROCESSES: "Processes",
};

function labelForAction(actionType: string): string {
  return ACTION_LABEL[actionType] ?? actionType;
}

/**
 * Compact, mobile-friendly formatting for devBOT replies.
 */
export function formatActionResultForTelegram(r: ActionResult): string {
  if (r.requiresApproval && r.details?.includes("/approve")) {
    const what = r.summary.replace(/^Pending( approval)?:\s*/i, "").trim();
    const lines = [
      "⏸ Approval needed",
      `${labelForAction(String(r.actionType))}: ${what}`,
      r.details?.trim(),
      "Tip: `/reject <same-id>` drops this request.",
    ];
    return truncateTelegram(lines.filter(Boolean).join("\n"));
  }

  if (r.success && r.summary.startsWith("DRY_RUN:")) {
    const lines = ["🧪 Dry-run", r.summary.trim(), r.details?.trim()].filter(Boolean);
    return truncateTelegram(lines.join("\n"));
  }

  const icon = r.success ? "✅" : "❌";
  const head = `${icon} ${labelForAction(String(r.actionType))}`;
  const body: string[] = [head, r.summary.trim()];

  if (r.details?.trim() && !r.requiresApproval) {
    body.push(r.details.trim());
  }

  if (r.error?.trim()) {
    body.push(`Cause: ${r.error.trim()}`);
  }

  if (r.output?.trim()) {
    const out = r.output.trim();
    const cap = 1800;
    const clipped = out.length > cap ? `${out.slice(0, cap)}\n… (output trimmed)` : out;
    body.push("", "```", clipped, "```");
  }

  return truncateTelegram(body.join("\n"));
}

/** Last N log lines with optional line numbers for quick scanning on phone. */
export function formatLogTailForTelegram(raw: string, tailLines = 28, numbered = true): string {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const slice = lines.slice(-tailLines);
  const start = lines.length - slice.length + 1;
  const formatted = numbered
    ? slice.map((line, i) => `${String(start + i).padStart(4, " ")}│ ${line}`)
    : slice;
  const header = `📋 Last ${slice.length} line(s)`;
  return truncateTelegram([header, "```", ...formatted, "```"].join("\n"));
}

export function humanizePipelinePhase(phase: string): string {
  const map: Record<string, string> = {
    analyzing: "Starting…",
    planning: "Planning (proposal + dry-run)…",
    awaiting_approval_plan: "Waiting for your /approve (plan step)",
    awaiting_approval_execute: "Waiting for your /approve (run commands)",
    running_commands: "Running allowlisted commands…",
    completed: "Done",
    failed: "Failed",
    killed: "Stopped",
    idle: "Idle",
    generating_stub: "Generating…",
    git_commit: "Git…",
  };
  return map[phase] ?? phase;
}
