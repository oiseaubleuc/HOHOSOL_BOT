import process from "node:process";
import { config as loadDotenv } from "dotenv";
import { TelegramClient } from "./telegramClient.js";
import { parseTelegramCommand } from "./parseCommand.js";
import { dispatchTelegramCommand } from "./commandDispatcher.js";
import { TaskRegistry, resolveTasksDir } from "../../services/taskRegistry.js";
import { PendingApprovalStore } from "../../services/pendingApprovalStore.js";
import { StatusService } from "../../services/statusService.js";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function isAuthorizedChat(chatId: number, allowed: string): boolean {
  return allowed === String(chatId) || allowed === String(Number(chatId));
}

/**
 * Long-polling loop for Telegram commands. Stops on SIGINT/SIGTERM.
 */
export async function startTelegramCommandListener(cwd = process.cwd()): Promise<void> {
  loadDotenv();
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const allowedChat = requireEnv("TELEGRAM_CHAT_ID");
  const timeout = Math.min(50, Math.max(1, Number(process.env.TELEGRAM_POLL_TIMEOUT ?? "45") || 45));

  const client = new TelegramClient(token);
  const registry = await TaskRegistry.load(resolveTasksDir(cwd));
  const pending = new PendingApprovalStore();
  const status = new StatusService();
  status.record("Telegram listener started.");

  let offset = 0;
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`[devBOT] Telegram polling (timeout=${timeout}s). Tasks dir: ${resolveTasksDir(cwd)}`);

  while (running) {
    let updates;
    try {
      updates = await client.getUpdates({ offset, timeout });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[devBOT] getUpdates error: ${msg}`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const u of updates) {
      offset = Math.max(offset, u.update_id + 1);
      const msg = u.message;
      if (!msg?.text) continue;
      if (!isAuthorizedChat(msg.chat.id, allowedChat)) {
        console.warn(`[devBOT] Ignoring chat_id=${msg.chat.id} (not TELEGRAM_CHAT_ID)`);
        continue;
      }

      const parsed = parseTelegramCommand(msg.text);
      if (!parsed) continue;

      await dispatchTelegramCommand(parsed, {
        cwd,
        client,
        chatId: msg.chat.id,
        registry,
        pending,
        status,
      });
    }
  }

  console.log("[devBOT] Telegram listener stopped.");
}
