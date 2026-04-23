import { describe, expect, it } from "vitest";
import {
  formatActionResultForTelegram,
  formatLogTailForTelegram,
  humanizePipelinePhase,
} from "../src/modules/telegram/telegramUx.js";
import type { ActionResult } from "../src/modules/developer-control/types.js";

describe("telegramUx", () => {
  it("formats approval-needed results compactly", () => {
    const r: ActionResult = {
      success: true,
      actionType: "CREATE_FOLDER",
      summary: "Pending: create desktop folder X",
      requiresApproval: true,
      details: "/approve DEV-deadbeef",
    };
    const t = formatActionResultForTelegram(r);
    expect(t).toContain("Approval needed");
    expect(t).toContain("/approve DEV-deadbeef");
  });

  it("formats failure with cause", () => {
    const r: ActionResult = {
      success: false,
      actionType: "RUN_BUILD",
      summary: "Build script exited non-zero",
      error: "exit 1",
      output: "first line\nsecond line",
    };
    const t = formatActionResultForTelegram(r);
    expect(t).toContain("❌");
    expect(t).toContain("Cause:");
  });

  it("formats log tail with line numbers", () => {
    const raw = ["a", "b", "c", "d"].join("\n");
    const t = formatLogTailForTelegram(raw, 3, true);
    expect(t).toContain("2│ b");
    expect(t).toContain("```");
  });

  it("humanizes pipeline phases", () => {
    expect(humanizePipelinePhase("running_commands")).toContain("Running");
  });
});
