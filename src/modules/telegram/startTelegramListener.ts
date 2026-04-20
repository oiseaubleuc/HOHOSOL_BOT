import process from "node:process";
import { loadRuntimeConfig } from "../../config/runtimeConfig.js";
import { TelegramClient } from "./telegramClient.js";
import { parseTelegramCommand } from "./parseCommand.js";
import { dispatchTelegramCommand } from "./commandDispatcher.js";
import { StatusService } from "../../services/statusService.js";
import { RunningTaskRegistry } from "../../state/runningTasks.js";
import { getBotEnvironment } from "../../workspace/init.js";

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
  const cfg = loadRuntimeConfig(cwd);
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const allowedChat = requireEnv("TELEGRAM_CHAT_ID");
  const timeout = cfg.telegramPollTimeoutSec;

  const { ws, registry } = await getBotEnvironment(cwd);
  const client = new TelegramClient(token);
  const status = new StatusService();
  const running = new RunningTaskRegistry();
  status.record("Telegram listener started.");

  let offset = 0;
  let runningLoop = true;
  const stop = () => {
    runningLoop = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`[devBOT] Telegram polling (timeout=${timeout}s). Workspace: ${ws.root}`);

  while (runningLoop) {
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
        ws,
        cfg,
        client,
        chatId: msg.chat.id,
        registry,
        status,
        running,
      });
    }
  }

  console.log("[devBOT] Telegram listener stopped.");
}
