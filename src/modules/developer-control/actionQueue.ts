import { randomBytes } from "node:crypto";
import type { ActionResult } from "./types.js";

export interface PendingDevAction {
  id: string;
  summary: string;
  createdAt: string;
  run: () => Promise<ActionResult>;
}

const pending = new Map<string, PendingDevAction>();

export function createDevActionId(): string {
  return `DEV-${randomBytes(4).toString("hex")}`;
}

export function enqueueDevAction(entry: PendingDevAction): void {
  pending.set(entry.id, entry);
}

export function peekDevAction(id: string): PendingDevAction | undefined {
  return pending.get(id);
}

export function listPendingDevActions(): PendingDevAction[] {
  return [...pending.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function approveDevAction(id: string): Promise<ActionResult | null> {
  const item = pending.get(id);
  if (!item) return null;
  pending.delete(id);
  return await item.run();
}

export function rejectDevAction(id: string): boolean {
  return pending.delete(id);
}

export function rejectAllDevActions(): number {
  const n = pending.size;
  pending.clear();
  return n;
}

export function resetDevActionQueueForTests(): void {
  pending.clear();
}
