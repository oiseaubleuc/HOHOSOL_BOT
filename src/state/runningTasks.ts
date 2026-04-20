export type RunPhase =
  | "idle"
  | "analyzing"
  | "planning"
  | "awaiting_approval_plan"
  | "generating_stub"
  | "awaiting_approval_execute"
  | "running_commands"
  | "git_commit"
  | "completed"
  | "failed"
  | "killed";

export interface RunningTaskInfo {
  taskId: string;
  phase: RunPhase;
  startedAt: string;
  updatedAt: string;
  lastError?: string;
  logPath?: string;
  reportPath?: string;
}

/**
 * In-memory task execution tracking (single-process).
 */
export class RunningTaskRegistry {
  private readonly tasks = new Map<string, RunningTaskInfo>();
  private readonly controllers = new Map<string, AbortController>();

  start(taskId: string, logPath: string): AbortController {
    const ac = new AbortController();
    this.controllers.set(taskId, ac);
    const now = new Date().toISOString();
    this.tasks.set(taskId, {
      taskId,
      phase: "analyzing",
      startedAt: now,
      updatedAt: now,
      logPath,
    });
    return ac;
  }

  update(taskId: string, patch: Partial<RunningTaskInfo>): void {
    const cur = this.tasks.get(taskId);
    if (!cur) return;
    this.tasks.set(taskId, { ...cur, ...patch, updatedAt: new Date().toISOString() });
  }

  get(taskId: string): RunningTaskInfo | undefined {
    return this.tasks.get(taskId);
  }

  list(): RunningTaskInfo[] {
    return [...this.tasks.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  kill(taskId: string): boolean {
    const c = this.controllers.get(taskId);
    if (!c) return false;
    c.abort();
    this.update(taskId, { phase: "killed" });
    this.controllers.delete(taskId);
    return true;
  }

  finish(taskId: string, phase: "completed" | "failed", err?: string): void {
    this.update(taskId, { phase, lastError: err });
    this.controllers.delete(taskId);
  }

  isRunning(taskId: string): boolean {
    return this.controllers.has(taskId);
  }

  signal(taskId: string): AbortSignal | undefined {
    return this.controllers.get(taskId)?.signal;
  }
}
