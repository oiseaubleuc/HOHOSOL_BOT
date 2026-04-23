import process from "node:process";
import qrcode from "qrcode-terminal";
import WhatsAppWeb from "whatsapp-web.js";
import { loadRuntimeConfig } from "../../config/runtimeConfig.js";
import { parseTelegramCommand } from "../telegram/parseCommand.js";
import { dispatchTelegramCommand } from "../telegram/commandDispatcher.js";
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

function normalizeChat(chat: string): string {
  return chat.replace(/\s+/g, "");
}

/**
 * WhatsApp listener that reuses the Telegram command parser/dispatcher.
 * Authorized chat should be a full WA jid, for example: 31612345678@c.us
 */
export async function startWhatsAppCommandListener(cwd = process.cwd()): Promise<void> {
  const { Client, LocalAuth } = WhatsAppWeb;
  const cfg = loadRuntimeConfig(cwd);
  const allowedChat = normalizeChat(requireEnv("WHATSAPP_ALLOWED_CHAT"));
  const sessionName = process.env.WHATSAPP_SESSION_NAME?.trim() || "devbot";

  const { ws, registry } = await getBotEnvironment(cwd);
  const status = new StatusService();
  const running = new RunningTaskRegistry();

  const wa = new Client({
    authStrategy: new LocalAuth({ clientId: sessionName, dataPath: ws.stateDir() }),
    puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });

  const client = {
    async sendMessage(_: number, text: string, _options?: unknown): Promise<void> {
      await wa.sendMessage(allowedChat, text);
    },
  };

  wa.on("qr", (qr) => {
    console.log("[devBOT] Scan this WhatsApp QR code:");
    qrcode.generate(qr, { small: true });
  });

  wa.on("ready", () => {
    status.record("WhatsApp listener ready.");
    console.log(`[devBOT] WhatsApp listener started. Workspace: ${ws.root}`);
  });

  wa.on("message", (msg) => {
    void (async () => {
      const from = normalizeChat(msg.from);
      if (from !== allowedChat) return;

      const parsed = parseTelegramCommand(msg.body);
      if (!parsed) {
        try {
          await wa.sendMessage(
            msg.from,
            "devBOT: no command detected. Messages must start with / (try /start or /tasks).",
          );
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          console.error(`[devBOT] WhatsApp hint send failed: ${m}`);
        }
        return;
      }

      await dispatchTelegramCommand(parsed, {
        ws,
        cfg,
        client,
        chatId: 0,
        registry,
        status,
        running,
      });
    })().catch((err) => console.error("[devBOT] WhatsApp message error", err));
  });

  wa.on("auth_failure", (message) => {
    console.error(`[devBOT] WhatsApp auth failure: ${message}`);
  });

  wa.on("disconnected", (reason) => {
    console.warn(`[devBOT] WhatsApp disconnected: ${reason}`);
  });

  const stop = async (): Promise<void> => {
    await wa.destroy().catch(() => undefined);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());

  await wa.initialize();
}
