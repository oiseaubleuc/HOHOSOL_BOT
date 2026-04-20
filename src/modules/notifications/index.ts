import { config as loadDotenv } from "dotenv";
import { ConsoleNotifier } from "./consoleNotifier.js";
import { TelegramNotifier } from "./telegramNotifier.js";
import type { Notifier, NotificationPayload } from "./types.js";

let dotenvLoaded = false;

function ensureDotenv(): void {
  if (dotenvLoaded) return;
  loadDotenv();
  dotenvLoaded = true;
}

/**
 * Sends to every inner notifier. Failures in non-console channels are logged, not thrown.
 */
class CompositeNotifier implements Notifier {
  constructor(private readonly inner: Notifier[]) {}

  async notify(payload: NotificationPayload): Promise<void> {
    for (const n of this.inner) {
      try {
        await n.notify(payload);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ai-dev-bot] Notifier error (${n.constructor.name}): ${msg}`);
      }
    }
  }
}

/**
 * Console always runs first. Telegram is appended when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set.
 * Loads `.env` from the current working directory once (via `dotenv`).
 */
export function createDefaultNotifier(): Notifier {
  ensureDotenv();
  const layers: Notifier[] = [new ConsoleNotifier()];
  const telegram = TelegramNotifier.tryFromEnv();
  if (telegram) layers.push(telegram);
  return new CompositeNotifier(layers);
}

export type { Notifier, NotificationPayload } from "./types.js";
export { ConsoleNotifier } from "./consoleNotifier.js";
export { TelegramNotifier, truncateForTelegram } from "./telegramNotifier.js";
