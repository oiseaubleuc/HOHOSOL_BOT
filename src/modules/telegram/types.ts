export type ParsedTelegramCommand =
  | { kind: "start" }
  | { kind: "tasks" }
  | { kind: "run"; taskId: string }
  | { kind: "status" }
  | { kind: "approve"; taskId: string }
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
