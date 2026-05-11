import type { RuntimeConfig } from "../../config/runtimeConfig.js";

function baseUrl(cfg: RuntimeConfig): string {
  return (cfg.hohobotBaseUrl ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

/**
 * `/ai` — appelle le routeur HOHOBOT (Ollama + cloud) via l’API locale.
 */
export async function callHohobotChat(cfg: RuntimeConfig, userMessage: string, agent: string): Promise<string> {
  const url = `${baseUrl(cfg)}/v1/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.hohobotApiToken) {
    headers["X-HOHOBOT-Token"] = cfg.hohobotApiToken;
  }
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agent,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    detail?: string;
    hohobot_engine?: string;
    hohobot_ms?: number;
  };
  if (!r.ok) {
    const d = data.detail ?? JSON.stringify(data);
    throw new Error(typeof d === "string" ? d : JSON.stringify(d));
  }
  const text = data.choices?.[0]?.message?.content ?? "";
  const eng = data.hohobot_engine;
  const ms = data.hohobot_ms;
  if (eng != null && ms != null) {
    return `[${eng} · ${ms}ms]\n${text}`;
  }
  return text;
}

/**
 * `/agent` — boucle outils Claude (serveur HOHOBOT + ANTHROPIC_API_KEY côté Python).
 */
export async function callHohobotAgent(cfg: RuntimeConfig, prompt: string): Promise<string> {
  const url = `${baseUrl(cfg)}/v1/agent/run`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.hohobotApiToken) {
    headers["X-HOHOBOT-Token"] = cfg.hohobotApiToken;
  }
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(300_000),
  });
  const data = (await r.json()) as { answer?: string; steps?: number; detail?: string; trace?: unknown[] };
  if (!r.ok) {
    const d = data.detail ?? JSON.stringify(data);
    throw new Error(typeof d === "string" ? d : JSON.stringify(d));
  }
  const answer = data.answer ?? "";
  const steps = data.steps ?? 0;
  return `${answer}\n\n_(${steps} step(s))_`;
}
