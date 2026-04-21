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
  | { kind: "open"; target: "cursor" | "vscode" | "terminal" | "finder" | "brave" | "safari"; project?: string }
  | { kind: "browser"; mode: "youtube" | "github" | "localhost" | "url"; port?: number; url?: string }
  | { kind: "projects" }
  | { kind: "open_project"; name: string }
  | { kind: "pwd_ws" }
  | { kind: "tree"; project: string }
  | { kind: "files"; project: string }
  | { kind: "dev"; tokens: string[] }
  | { kind: "ports" }
  | { kind: "processes" }
  | { kind: "kill_port"; port: number }
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
