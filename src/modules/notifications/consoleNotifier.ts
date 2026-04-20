import type { NotificationPayload, Notifier } from "./types.js";

function format(payload: NotificationPayload): string {
  switch (payload.kind) {
    case "task_started":
      return `[ai-dev-bot] Started (${payload.mode}) — ${payload.taskId}: ${payload.title}\n  project: ${payload.projectRoot}`;
    case "task_completed":
      return `[ai-dev-bot] Completed — ${payload.taskId}: ${payload.title}\n  ${payload.summary}`;
    case "task_failed":
      return `[ai-dev-bot] Failed — ${payload.taskId}: ${payload.title}\n  ${payload.error}`;
    case "task_requires_approval":
      return `[ai-dev-bot] Approval required — ${payload.taskId}: ${payload.title}\n  checksum: ${payload.checksum}\n  proposal: ${payload.proposalPath}\n  dryRun: ${payload.dryRun}`;
  }
}

export class ConsoleNotifier implements Notifier {
  async notify(payload: NotificationPayload): Promise<void> {
    const line = format(payload);
    if (payload.kind === "task_failed") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}
