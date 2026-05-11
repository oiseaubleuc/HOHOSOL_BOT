import type { ParsedTelegramCommand } from "./types.js";
import type { ScaffoldType } from "../../types/scaffold.js";
import { resolveMacBundleKey } from "../developer-control/adapters/macBundles.js";

const SCAFFOLDS = new Set<string>(["node-api", "nextjs", "laravel", "saas-template"]);

function parsePort(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : undefined;
}

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

  /** Text after token index `from` (slash command tail), capped for Telegram. */
  function browserQueryFrom(from: number): string | undefined {
    const rest = tokens.slice(from).join(" ").trim();
    if (!rest) return undefined;
    return rest.slice(0, 500);
  }

  switch (base) {
    case "/start":
      return { kind: "start" };
    case "/help":
      return { kind: "help" };
    case "/quick":
      return { kind: "quick" };
    case "/menu":
      return { kind: "menu" };
    case "/chat": {
      const rest = tokens.slice(1).join(" ").trim();
      return { kind: "assistant_chat", message: rest.slice(0, 12000) };
    }
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
    case "/open": {
      const a1 = arg(1)?.toLowerCase().replace(/_/g, "-");
      if (!a1) return { kind: "unknown", raw: trimmed };
      if (a1 === "localhost") {
        const p = parsePort(arg(2));
        if (!p) return { kind: "unknown", raw: trimmed };
        return { kind: "browser", mode: "localhost", port: p };
      }
      if (a1 === "youtube") {
        const q = browserQueryFrom(2);
        return q ? { kind: "browser", mode: "youtube", query: q } : { kind: "browser", mode: "youtube" };
      }
      if (a1 === "github") {
        const q = browserQueryFrom(2);
        return q ? { kind: "browser", mode: "github", query: q } : { kind: "browser", mode: "github" };
      }
      const macKey = resolveMacBundleKey(a1);
      if (macKey) {
        return { kind: "open", target: macKey, project: undefined };
      }
      const appTargets = new Set(["cursor", "vscode", "terminal", "finder", "brave", "safari"]);
      if (!appTargets.has(a1)) return { kind: "unknown", raw: trimmed };
      return {
        kind: "open",
        target: a1 as "cursor" | "vscode" | "terminal" | "finder" | "brave" | "safari",
        project: arg(2),
      };
    }
    case "/browser": {
      const sub = arg(1)?.toLowerCase();
      const what = arg(2)?.toLowerCase();
      if (sub !== "open" || !what) return { kind: "unknown", raw: trimmed };
      if (what === "youtube") {
        const q = browserQueryFrom(3);
        return q ? { kind: "browser", mode: "youtube", query: q } : { kind: "browser", mode: "youtube" };
      }
      if (what === "github") {
        const q = browserQueryFrom(3);
        return q ? { kind: "browser", mode: "github", query: q } : { kind: "browser", mode: "github" };
      }
      if (what === "localhost") {
        const p = parsePort(arg(3));
        if (!p) return { kind: "unknown", raw: trimmed };
        return { kind: "browser", mode: "localhost", port: p };
      }
      if (what === "url") {
        const u = tokens.slice(3).join(" ").trim();
        if (!u) return { kind: "unknown", raw: trimmed };
        return { kind: "browser", mode: "url", url: u };
      }
      return { kind: "unknown", raw: trimmed };
    }
    case "/projects":
      return { kind: "projects" };
    case "/open-project":
    case "/openproject": {
      const n = arg(1);
      if (!n) return { kind: "unknown", raw: trimmed };
      return { kind: "open_project", name: n };
    }
    case "/pwd":
      return { kind: "pwd_ws" };
    case "/tree": {
      const p = arg(1);
      if (!p) return { kind: "unknown", raw: trimmed };
      return { kind: "tree", project: p };
    }
    case "/files": {
      const p = arg(1);
      if (!p) return { kind: "unknown", raw: trimmed };
      return { kind: "files", project: p };
    }
    case "/dev": {
      const rest = tokens.slice(1).map((t) => t.trim()).filter(Boolean);
      return { kind: "dev", tokens: rest };
    }
    case "/ports":
      return { kind: "ports" };
    case "/processes":
      return { kind: "processes" };
    case "/kill-port":
    case "/kill_port":
    case "/killport": {
      const p = parsePort(arg(1));
      if (!p) return { kind: "unknown", raw: trimmed };
      return { kind: "kill_port", port: p };
    }
    case "/system": {
      const sub = arg(1)?.toLowerCase();
      if (!sub) return { kind: "unknown", raw: trimmed };
      if (sub !== "create-folder" && sub !== "create-folder-in-desktop" && sub !== "create-folder-in-future-projects") {
        return { kind: "unknown", raw: trimmed };
      }
      const folderRaw = tokens.slice(2).join(" ").trim();
      if (!folderRaw) return { kind: "unknown", raw: trimmed };
      return {
        kind: "system",
        action: sub as "create-folder" | "create-folder-in-desktop" | "create-folder-in-future-projects",
        folderName: folderRaw,
      };
    }
    case "/ask": {
      const instruction = tokens.slice(1).join(" ").trim();
      if (!instruction) return { kind: "unknown", raw: trimmed };
      return { kind: "ask", instruction };
    }
    case "/ai": {
      const message = tokens.slice(1).join(" ").trim();
      if (!message) return { kind: "unknown", raw: trimmed };
      return { kind: "hohobot_ai", message };
    }
    case "/agent": {
      const message = tokens.slice(1).join(" ").trim();
      if (!message) return { kind: "unknown", raw: trimmed };
      return { kind: "hohobot_agent", message };
    }
    default:
      return { kind: "unknown", raw: trimmed };
  }
}
