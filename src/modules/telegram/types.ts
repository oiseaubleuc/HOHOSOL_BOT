import type { ScaffoldType } from "../../types/scaffold.js";
import type { MacBundleOpenKey } from "../developer-control/adapters/macBundles.js";

export type OpenIdeTarget = "cursor" | "vscode" | "terminal" | "finder" | "brave" | "safari";

export type ParsedTelegramCommand =
  | { kind: "start" }
  | { kind: "help" }
  | { kind: "quick" }
  | { kind: "menu" }
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
  | { kind: "open"; target: OpenIdeTarget | MacBundleOpenKey; project?: string }
  | {
      kind: "browser";
      mode: "youtube" | "github" | "localhost" | "url";
      port?: number;
      url?: string;
      /** Search keywords when mode is youtube or github (opens results page on allowed host). */
      query?: string;
    }
  | { kind: "projects" }
  | { kind: "open_project"; name: string }
  | { kind: "pwd_ws" }
  | { kind: "tree"; project: string }
  | { kind: "files"; project: string }
  | { kind: "dev"; tokens: string[] }
  | { kind: "ports" }
  | { kind: "processes" }
  | { kind: "kill_port"; port: number }
  | {
      kind: "system";
      action: "create-folder" | "create-folder-in-desktop" | "create-folder-in-future-projects";
      folderName: string;
    }
  | { kind: "ask"; instruction: string }
  /** HOHOBOT hybrid router (`hobot serve` must be running). */
  | { kind: "hohobot_ai"; message: string }
  /** HOHOBOT Claude tool agent (`hobot serve` + ANTHROPIC_API_KEY on worker). */
  | { kind: "hohobot_agent"; message: string }
  /** LLM conversation only (`/chat …`) — does not run shell / open apps. */
  | { kind: "assistant_chat"; message: string }
  | { kind: "unknown"; raw: string };

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type?: string };
  text?: string;
  caption?: string;
  /** User sent a photo (e.g. screenshot). Bots cannot receive screen-share video. */
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
}

export interface TelegramCallbackQuery {
  id: string;
  from?: { id: number };
  message?: { chat: { id: number }; message_id: number };
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}
