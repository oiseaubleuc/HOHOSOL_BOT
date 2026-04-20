export interface PendingApproval {
  taskId: string;
  taskPath: string;
  proposalPath: string;
  reportPath: string;
  checksum: string;
  updatedAt: string;
}

/**
 * In-memory pending `/run` → `/approve` hand-off (cleared on process restart).
 */
export class PendingApprovalStore {
  private readonly pending = new Map<string, PendingApproval>();

  set(entry: PendingApproval): void {
    this.pending.set(entry.taskId, entry);
  }

  get(taskId: string): PendingApproval | undefined {
    return this.pending.get(taskId);
  }

  clear(taskId: string): void {
    this.pending.delete(taskId);
  }
}
