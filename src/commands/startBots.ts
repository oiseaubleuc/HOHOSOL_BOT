import process from "node:process";

/**
 * Runs Telegram and/or WhatsApp listeners concurrently (each blocks until exit).
 * Skips a channel when its env is missing instead of failing the whole process.
 */
export async function startBothBotListeners(cwd = process.cwd()): Promise<void> {
  const tg = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const wa = process.env.WHATSAPP_ALLOWED_CHAT?.trim();

  const runners: Promise<void>[] = [];

  if (tg) {
    const { startTelegramCommandListener } = await import("../modules/telegram/startTelegramListener.js");
    runners.push(startTelegramCommandListener(cwd));
  } else {
    console.warn("[devBOT] TELEGRAM_BOT_TOKEN missing — Telegram listener not started.");
  }

  if (wa) {
    const { startWhatsAppCommandListener } = await import("../modules/whatsapp/startWhatsAppListener.js");
    const p = startWhatsAppCommandListener(cwd).catch((err) => {
      const m = err instanceof Error ? err.message : String(err);
      console.error(`[devBOT] WhatsApp listener failed: ${m}`);
    });
    runners.push(p);
  } else {
    console.warn("[devBOT] WHATSAPP_ALLOWED_CHAT missing — WhatsApp listener not started.");
  }

  if (runners.length === 0) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and/or WHATSAPP_ALLOWED_CHAT in .env");
  }

  await Promise.all(runners);
}
