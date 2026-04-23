import { describe, expect, it, vi, afterEach } from "vitest";
import { runAssistantChat } from "../src/modules/telegram/telegramAssistantChat.js";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";

const baseCfg: RuntimeConfig = {
  workspacePath: "/tmp/w",
  dryRun: true,
  autoApprove: false,
  assistantName: "devBOT",
  assistantGreeting: "hi",
  desktopAllowedPaths: [],
  telegramPollTimeoutSec: 30,
};

describe("runAssistantChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for API key when missing", async () => {
    const t = await runAssistantChat("hello", { ...baseCfg, openaiApiKey: undefined });
    expect(t).toContain("OPENAI_API_KEY");
  });

  it("returns assistant text on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Voici une explication courte." } }],
        }),
      })) as unknown as typeof fetch,
    );
    const t = await runAssistantChat("Qu’est-ce que TypeScript ?", {
      ...baseCfg,
      openaiApiKey: "sk-test",
    });
    expect(t).toContain("explication");
  });
});
