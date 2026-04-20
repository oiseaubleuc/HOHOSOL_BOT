import { describe, expect, it } from "vitest";
import { truncateForTelegram } from "../src/modules/notifications/telegramNotifier.js";

describe("truncateForTelegram", () => {
  it("leaves short strings unchanged", () => {
    expect(truncateForTelegram("hello")).toBe("hello");
  });

  it("truncates very long payloads", () => {
    const long = "x".repeat(5000);
    const out = truncateForTelegram(long);
    expect(out.length).toBeLessThanOrEqual(5000);
    expect(out.endsWith("\n…(truncated)")).toBe(true);
  });
});
