export interface StatusSnapshot {
  updatedAt: string;
  summary: string;
}

/**
 * Lightweight last-action summary for `/status`.
 */
export class StatusService {
  private snapshot: StatusSnapshot = {
    updatedAt: new Date(0).toISOString(),
    summary: "No commands yet.",
  };

  record(summary: string): void {
    this.snapshot = { updatedAt: new Date().toISOString(), summary };
  }

  get(): StatusSnapshot {
    return this.snapshot;
  }
}
