import { describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";
import { planAskInstruction } from "../src/modules/telegram/askPlanner.js";

const testCfg: RuntimeConfig = {
  workspacePath: "/tmp/ws",
  dryRun: true,
  autoApprove: false,
  assistantName: "devBOT",
  assistantGreeting: "hi",
  desktopAllowedPaths: [],
  telegramPollTimeoutSec: 30,
};

describe("planAskInstruction", () => {
  it("maps French free text to /open brave (heuristics, no API key required)", async () => {
    const plan = await planAskInstruction("ouvre Brave", { ...testCfg, openaiApiKey: undefined });
    expect(plan.needsClarification).toBe(false);
    expect(plan.slash).toBe("/open brave");
    expect(plan.mapped).toEqual({ kind: "open", target: "brave", project: undefined });
  });

  it("maps plain youtube mention to browser command", async () => {
    const plan = await planAskInstruction("lance YouTube dans le navigateur", {
      ...testCfg,
      openaiApiKey: undefined,
    });
    expect(plan.needsClarification).toBe(false);
    expect(plan.mapped).toEqual({ kind: "browser", mode: "youtube" });
  });

  it("maps cherche … sur youtube to search query", async () => {
    const plan = await planAskInstruction("cherche tutoriel graphql sur youtube", {
      ...testCfg,
      openaiApiKey: undefined,
    });
    expect(plan.needsClarification).toBe(false);
    expect(plan.slash).toBe("/browser open youtube tutoriel graphql");
    expect(plan.mapped).toEqual({
      kind: "browser",
      mode: "youtube",
      query: "tutoriel graphql",
    });
  });

  it("maps sujet sur github", async () => {
    const plan = await planAskInstruction("vitest sur github", { ...testCfg, openaiApiKey: undefined });
    expect(plan.needsClarification).toBe(false);
    expect(plan.mapped).toEqual({ kind: "browser", mode: "github", query: "vitest" });
  });
});
