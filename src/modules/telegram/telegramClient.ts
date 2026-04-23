import type { TelegramUpdate } from "./types.js";

/** Optional extras for Telegram `sendMessage`. */
export interface TelegramSendOptions {
  reply_markup?: unknown;
}

export class TelegramClient {
  constructor(private readonly token: string) {}

  private url(method: string): string {
    return `https://api.telegram.org/bot${this.token}/${method}`;
  }

  async getMe(): Promise<{ id: number; username?: string; first_name?: string }> {
    const res = await fetch(this.url("getMe"));
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`getMe failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      ok: boolean;
      result?: { id: number; username?: string; first_name?: string };
      description?: string;
    };
    if (!json.ok || !json.result) {
      throw new Error(json.description ?? "getMe: ok=false");
    }
    return json.result;
  }

  async getUpdates(input: { offset: number; timeout: number }): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({
      offset: String(input.offset),
      timeout: String(input.timeout),
    });
    const res = await fetch(`${this.url("getUpdates")}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`getUpdates failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { ok: boolean; result?: TelegramUpdate[]; description?: string };
    if (!json.ok) {
      throw new Error(json.description ?? "getUpdates: ok=false");
    }
    return json.result ?? [];
  }

  async sendMessage(chatId: number | string, text: string, options?: TelegramSendOptions): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: text.length > 4090 ? `${text.slice(0, 4030)}\n…(truncated)` : text,
      disable_web_page_preview: true,
    };
    if (options?.reply_markup) {
      body.reply_markup = options.reply_markup;
    }
    const res = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`sendMessage failed: HTTP ${res.status} ${errBody.slice(0, 200)}`);
    }
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      throw new Error(json.description ?? "sendMessage: ok=false");
    }
  }

  async answerCallbackQuery(input: { callback_query_id: string; text?: string; show_alert?: boolean }): Promise<void> {
    const res = await fetch(this.url("answerCallbackQuery"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: input.callback_query_id,
        text: input.text,
        show_alert: input.show_alert,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[devBOT] answerCallbackQuery failed: HTTP ${res.status} ${errBody.slice(0, 200)}`);
      return;
    }
    const json = (await res.json()) as { ok: boolean };
    if (!json.ok) {
      console.error("[devBOT] answerCallbackQuery: ok=false");
    }
  }

  /** Native “Menu” command list in Telegram clients. */
  async setMyCommands(
    commands: Array<{ command: string; description: string }>,
  ): Promise<void> {
    const res = await fetch(this.url("setMyCommands"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[devBOT] setMyCommands failed: HTTP ${res.status} ${errBody.slice(0, 200)}`);
      return;
    }
    const json = (await res.json()) as { ok: boolean };
    if (!json.ok) {
      console.warn("[devBOT] setMyCommands: ok=false");
    }
  }
}
