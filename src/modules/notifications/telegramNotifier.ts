import type { NotificationPayload, Notifier } from "./types.js";

const TELEGRAM_MESSAGE_MAX = 4090;

function formatTelegramBody(payload: NotificationPayload): string {
  switch (payload.kind) {
    case "task_started":
      return `▶ ${payload.taskId} (${payload.mode})\n${payload.title}\n${payload.projectRoot}`;
    case "task_completed":
      return `✅ ${payload.taskId}\n${payload.title}\n${payload.summary}`;
    case "task_failed":
      return `❌ ${payload.taskId}\n${payload.title}\n${payload.error}`;
    case "task_requires_approval":
      return (
        `⏸ Approval · ${payload.taskId}\n${payload.title}\n` +
        `checksum: ${payload.checksum}\nproposal: ${payload.proposalPath}\ndryRun: ${String(payload.dryRun)}`
      );
    default: {
      const _exhaustive: never = payload;
      return String(_exhaustive);
    }
  }
}

export function truncateForTelegram(text: string): string {
  if (text.length <= TELEGRAM_MESSAGE_MAX) return text;
  return `${text.slice(0, TELEGRAM_MESSAGE_MAX)}\n…(truncated)`;
}

export class TelegramNotifier implements Notifier {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
  ) {}

  /**
   * Returns a notifier when both env vars are set and non-empty; otherwise `undefined`.
   */
  static tryFromEnv(): TelegramNotifier | undefined {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) return undefined;
    return new TelegramNotifier(token, chatId);
  }

  async notify(payload: NotificationPayload): Promise<void> {
    const text = truncateForTelegram(`devBOT\n${formatTelegramBody(payload)}`);
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const body = {
      chat_id: this.chatId,
      text,
      disable_web_page_preview: true,
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ai-dev-bot] Telegram send failed (network): ${msg}`);
      return;
    }

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = (await res.json()) as { description?: string };
        if (j.description) detail = j.description;
      } catch {
        // ignore parse errors
      }
      console.error(`[ai-dev-bot] Telegram send failed: HTTP ${res.status} ${detail}`);
    }
  }
}
