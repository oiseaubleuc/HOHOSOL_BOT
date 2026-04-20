import type { ParsedTelegramCommand } from "./types.js";

/**
 * Parses Telegram `message.text` into a devBOT command.
 * Supports `/cmd@BotName` suffixes.
 */
export function parseTelegramCommand(text: string | undefined): ParsedTelegramCommand | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const first = tokens[0]!;
  const base = first.split("@")[0]!.toLowerCase();
  const arg = tokens[1]?.trim();

  switch (base) {
    case "/start":
      return { kind: "start" };
    case "/tasks":
      return { kind: "tasks" };
    case "/status":
      return { kind: "status" };
    case "/run":
      if (!arg) return { kind: "unknown", raw: trimmed };
      return { kind: "run", taskId: arg };
    case "/approve":
      if (!arg) return { kind: "unknown", raw: trimmed };
      return { kind: "approve", taskId: arg };
    default:
      return { kind: "unknown", raw: trimmed };
  }
}
