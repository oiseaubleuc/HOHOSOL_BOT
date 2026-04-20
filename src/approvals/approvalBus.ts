/**
 * Per-task FIFO approval gates. Used by the agent pipeline and Telegram `/approve`.
 * When `AUTO_APPROVE=true` (via {@link loadRuntimeConfig}), all waits resolve immediately.
 */
export class ApprovalBus {
  private static instance: ApprovalBus | undefined;

  static get(): ApprovalBus {
    if (!ApprovalBus.instance) ApprovalBus.instance = new ApprovalBus();
    return ApprovalBus.instance;
  }

  static resetForTests(): void {
    ApprovalBus.instance = undefined;
  }

  private readonly queue: Array<{
    taskId: string;
    step: string;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];

  private autoApprove = false;

  setAutoApprove(v: boolean): void {
    this.autoApprove = v;
  }

  /** Next pending step label for a task (for /status). */
  peek(taskId: string): string | undefined {
    return this.queue.find((q) => q.taskId === taskId)?.step;
  }

  pendingCount(taskId: string): number {
    return this.queue.filter((q) => q.taskId === taskId).length;
  }

  wait(taskId: string, step: string): Promise<void> {
    if (this.autoApprove) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.queue.push({ taskId, step, resolve, reject });
    });
  }

  approveNext(taskId: string): boolean {
    const idx = this.queue.findIndex((q) => q.taskId === taskId);
    if (idx === -1) return false;
    const [item] = this.queue.splice(idx, 1);
    item.resolve();
    return true;
  }

  rejectTask(taskId: string): number {
    let n = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i]!;
      if (q.taskId !== taskId) continue;
      this.queue.splice(i, 1);
      q.reject(new Error("Rejected by user"));
      n++;
    }
    return n;
  }
}
