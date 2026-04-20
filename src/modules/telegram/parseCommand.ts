import type { ParsedTelegramCommand } from "./types.js";
import type { ScaffoldType } from "../../types/scaffold.js";

const SCAFFOLDS = new Set<string>(["node-api", "nextjs", "laravel", "saas-template"]);

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

  const arg = (i: number) => tokens[i]?.trim();

  switch (base) {
    case "/start":
      return { kind: "start" };
    case "/tasks":
      return { kind: "tasks" };
    case "/status":
      return { kind: "status" };
    case "/workspace":
      return { kind: "workspace" };
    case "/health":
      return { kind: "health" };
    case "/run":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "run", taskId: arg(1)! };
    case "/approve":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "approve", taskId: arg(1)! };
    case "/reject":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "reject", taskId: arg(1)! };
    case "/logs":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "logs", taskId: arg(1)! };
    case "/report":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "report", taskId: arg(1)! };
    case "/kill":
      if (!arg(1)) return { kind: "unknown", raw: trimmed };
      return { kind: "kill", taskId: arg(1)! };
    case "/create": {
      const name = arg(1);
      const type = arg(2) as ScaffoldType | undefined;
      if (!name || !type || !SCAFFOLDS.has(type)) return { kind: "unknown", raw: trimmed };
      return { kind: "create", name, type };
    }
    default:
      return { kind: "unknown", raw: trimmed };
  }
}
