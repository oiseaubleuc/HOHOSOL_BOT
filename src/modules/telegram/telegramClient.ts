import type { TelegramUpdate } from "./types.js";

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

  async sendMessage(chatId: number | string, text: string): Promise<void> {
    const res = await fetch(this.url("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.length > 4090 ? `${text.slice(0, 4030)}\n…(truncated)` : text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`sendMessage failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      throw new Error(json.description ?? "sendMessage: ok=false");
    }
  }
}
