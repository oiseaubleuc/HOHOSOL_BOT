import process from "node:process";
import { loadRuntimeConfig } from "../../config/runtimeConfig.js";
import { TelegramClient } from "./telegramClient.js";
import { parseTelegramCommand } from "./parseCommand.js";
import { dispatchTelegramCommand } from "./commandDispatcher.js";
import { mapReplyKeyboardToCommand, parseInlineCallbackData } from "./telegramKeyboards.js";
import { defaultBotCommands } from "./telegramBotCommands.js";
import { StatusService } from "../../services/statusService.js";
import { RunningTaskRegistry } from "../../state/runningTasks.js";
import { getBotEnvironment } from "../../workspace/init.js";

/** Photo reçue : rappel court (pas de vision / pas de flux écran via le bot). */
const PHOTO_HINT_FR =
  "📷 Image reçue. Ce bot ne lit pas encore le contenu des photos.\n" +
  "Pour voir l’écran du Mac à distance : Partage d’écran macOS, RustDesk, TeamViewer, etc. (en dehors de Telegram).";

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
    "🔐 Configuration devBOT",
    `Ton chat id : \`${chatId}\``,
    `Dans .env : TELEGRAM_CHAT_ID=${chatId}`,
    "Redémarre le listener — les commandes ne marcheront que depuis ce chat.",
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

  const providerLine = cfg.openaiApiKey
    ? `OpenAI (${cfg.openaiModel ?? "default"})`
    : cfg.openRouterModel
      ? `OpenRouter (${cfg.openRouterModel})`
      : "LLM not configured";
  console.log(`[devBOT] Telegram polling (timeout=${timeout}s). Workspace: ${ws.root}`);
  console.log(`[devBOT] startup: provider=${providerLine}`);
  console.log(`[devBOT] startup: approval_mode=${cfg.autoApprove ? "AUTO_APPROVE" : "MANUAL_APPROVAL"}`);
  console.log(`[devBOT] startup: dry_run=${cfg.dryRun}`);
  if (bootstrapMode) {
    console.warn(
      "[devBOT] TELEGRAM_CHAT_ID unset or placeholder (0): bootstrap mode. Send any text to the bot to receive your chat id. Commands stay disabled until TELEGRAM_CHAT_ID is set and you restart.",
    );
  }

  try {
    const me = await client.getMe();
    console.log(`[devBOT] Telegram bot @${me.username ?? "(no username)"} id=${me.id}`);
    await client.setMyCommands(defaultBotCommands());
    console.log("[devBOT] setMyCommands: menu Telegram enregistré");
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

      const cq = u.callback_query;
      if (cq?.data !== undefined && cq.message?.chat.id !== undefined) {
        const chatId = cq.message.chat.id;
        if (bootstrapMode) {
          await client.answerCallbackQuery({ callback_query_id: cq.id, text: "Configure TELEGRAM_CHAT_ID d’abord." });
          continue;
        }
        if (!isAuthorizedChat(chatId, allowedChat)) {
          await client.answerCallbackQuery({ callback_query_id: cq.id, text: "Chat non autorisé", show_alert: true });
          continue;
        }
        const mapped = parseInlineCallbackData(cq.data);
        if (!mapped) {
          await client.answerCallbackQuery({ callback_query_id: cq.id, text: "Action inconnue" });
          continue;
        }
        await client.answerCallbackQuery({ callback_query_id: cq.id });
        await dispatchTelegramCommand(mapped, {
          ws,
          cfg,
          client,
          chatId,
          registry,
          status,
          running,
        });
        continue;
      }

      const msg = u.message;
      if (!msg) continue;

      if (bootstrapMode) {
        try {
          if (msg.photo?.length) {
            await client.sendMessage(msg.chat.id, `${bootstrapHelp(msg.chat.id)}\n\n${PHOTO_HINT_FR}`);
          } else {
            await client.sendMessage(msg.chat.id, bootstrapHelp(msg.chat.id));
          }
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
              `⛔️ Wrong chat for this bot.`,
              `Your id: \`${msg.chat.id}\``,
              `Expected: \`TELEGRAM_CHAT_ID=${allowedChat}\` in .env → restart.`,
            ].join("\n"),
          );
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] unauthorized hint sendMessage failed: ${m}`);
        }
        continue;
      }

      if (msg.photo?.length) {
        try {
          await client.sendMessage(msg.chat.id, PHOTO_HINT_FR);
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] photo hint sendMessage failed: ${m}`);
        }
        const caption = msg.caption?.trim();
        if (caption) {
          await dispatchTelegramCommand({ kind: "ask", instruction: caption.slice(0, 4000) }, {
            ws,
            cfg,
            client,
            chatId: msg.chat.id,
            registry,
            status,
            running,
          });
        }
        continue;
      }

      if (!msg.text?.trim()) continue;

      let text = msg.text.trim();
      const fromKeyboard = mapReplyKeyboardToCommand(text);
      if (fromKeyboard) text = fromKeyboard;
      const parsed = parseTelegramCommand(text);
      if (!parsed) {
        if (!text) continue;
        await dispatchTelegramCommand({ kind: "ask", instruction: text.slice(0, 4000) }, {
          ws,
          cfg,
          client,
          chatId: msg.chat.id,
          registry,
          status,
          running,
        });
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
