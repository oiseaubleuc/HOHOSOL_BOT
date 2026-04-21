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

/** Empty, missing, or placeholder `0` → same as unset (bootstrap / discover chat id). */
function isTelegramChatUnset(raw: string): boolean {
  const t = raw.trim();
  return t.length === 0 || t === "0";
}

function bootstrapHelp(chatId: number): string {
  return [
    `devBOT — Telegram setup`,
    ``,
    `Your chat id is: ${chatId}`,
    ``,
    `Add this to your .env and restart the listener:`,
    `TELEGRAM_CHAT_ID=${chatId}`,
    ``,
    `Until then, bot commands stay disabled (bootstrap mode).`,
  ].join("\n");
}

/**
 * Long-polling loop for Telegram commands. Stops on SIGINT/SIGTERM.
 */
export async function startTelegramCommandListener(cwd = process.cwd()): Promise<void> {
  const cfg = loadRuntimeConfig(cwd);
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const allowedChatRaw = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  const bootstrapMode = isTelegramChatUnset(allowedChatRaw);
  const allowedChat = allowedChatRaw;
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
  if (bootstrapMode) {
    console.warn(
      "[devBOT] TELEGRAM_CHAT_ID unset or placeholder (0): bootstrap mode. Send any text to the bot to receive your chat id. Commands stay disabled until TELEGRAM_CHAT_ID is set and you restart.",
    );
  }

  try {
    const me = await client.getMe();
    console.log(`[devBOT] Telegram bot @${me.username ?? "(no username)"} id=${me.id}`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error(`[devBOT] getMe failed (check TELEGRAM_BOT_TOKEN): ${m}`);
  }

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

      if (bootstrapMode) {
        try {
          await client.sendMessage(msg.chat.id, bootstrapHelp(msg.chat.id));
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] bootstrap sendMessage failed: ${m}`);
        }
        console.log(`[devBOT] bootstrap: chat_id=${msg.chat.id} (set TELEGRAM_CHAT_ID and restart)`);
        continue;
      }

      if (!isAuthorizedChat(msg.chat.id, allowedChat)) {
        console.warn(`[devBOT] Ignoring chat_id=${msg.chat.id} (expected TELEGRAM_CHAT_ID=${allowedChat})`);
        try {
          await client.sendMessage(
            msg.chat.id,
            [
              `devBOT: this chat is not authorized.`,
              ``,
              `Your chat id: ${msg.chat.id}`,
              `Expected in .env: TELEGRAM_CHAT_ID=${allowedChat}`,
              ``,
              `Fix .env, restart the listener, then try /start again.`,
            ].join("\n"),
          );
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] unauthorized hint sendMessage failed: ${m}`);
        }
        continue;
      }

      const parsed = parseTelegramCommand(msg.text);
      if (!parsed) {
        try {
          await client.sendMessage(
            msg.chat.id,
            "devBOT: no command detected. Messages must start with / (try /start or /tasks).",
          );
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] hint sendMessage failed: ${m}`);
        }
        continue;
      }

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
