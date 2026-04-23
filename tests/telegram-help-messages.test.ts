import { describe, expect, it } from "vitest";
import { devBotQuickSheet, devBotHelpFull } from "../src/modules/telegram/telegramHelpMessages.js";
import type { RuntimeConfig } from "../src/config/runtimeConfig.js";

const cfg: RuntimeConfig = {
  workspacePath: "/tmp/w",
  dryRun: true,
  autoApprove: false,
  assistantName: "devBOT",
  assistantGreeting: "Hi",
  desktopAllowedPaths: [],
  telegramPollTimeoutSec: 30,
};

describe("telegramHelpMessages", () => {
  it("quick sheet mentions core loop", () => {
    const t = devBotQuickSheet(cfg);
    expect(t).toContain("/tasks");
    expect(t).toContain("/approve");
  });

  it("full help mentions control plane and dev", () => {
    const t = devBotHelpFull(cfg);
    expect(t).toContain("Control plane");
    expect(t).toContain("/dev");
  });
});
