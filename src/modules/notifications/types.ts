/**
 * Lifecycle events for a `run` or `execute-proposal` flow.
 * Designed so a future Slack notifier can implement the same `Notifier` interface.
 */
export type NotificationPayload =
  | {
      kind: "task_started";
      taskId: string;
      title: string;
      projectRoot: string;
      mode: "run" | "execute-proposal";
    }
  | {
      kind: "task_completed";
      taskId: string;
      title: string;
      reportPath?: string;
      summary: string;
    }
  | {
      kind: "task_failed";
      taskId: string;
      title: string;
      error: string;
    }
  | {
      kind: "task_requires_approval";
      taskId: string;
      title: string;
      checksum: string;
      proposalPath: string;
      dryRun: boolean;
    };

export interface Notifier {
  notify(payload: NotificationPayload): Promise<void>;
}
