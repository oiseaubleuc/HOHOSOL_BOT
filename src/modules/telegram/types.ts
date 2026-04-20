import type { ScaffoldType } from "../../types/scaffold.js";

export type ParsedTelegramCommand =
  | { kind: "start" }
  | { kind: "tasks" }
  | { kind: "run"; taskId: string }
  | { kind: "status" }
  | { kind: "approve"; taskId: string }
  | { kind: "reject"; taskId: string }
  | { kind: "create"; name: string; type: ScaffoldType }
  | { kind: "logs"; taskId: string }
  | { kind: "report"; taskId: string }
  | { kind: "kill"; taskId: string }
  | { kind: "workspace" }
  | { kind: "health" }
  | { kind: "unknown"; raw: string };

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type?: string };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
