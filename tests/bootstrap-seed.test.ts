import { describe, expect, it, afterEach } from "vitest";
import { isSampleTaskSeedingEnabled } from "../src/workspace/bootstrapWorkspace.js";

describe("isSampleTaskSeedingEnabled", () => {
  afterEach(() => {
    delete process.env.DEVBOT_SEED_SAMPLE_TASKS;
  });

  it("defaults to true when unset", () => {
    delete process.env.DEVBOT_SEED_SAMPLE_TASKS;
    expect(isSampleTaskSeedingEnabled()).toBe(true);
  });

  it("is false for false-like values", () => {
    for (const v of ["0", "false", "no", "OFF"]) {
      process.env.DEVBOT_SEED_SAMPLE_TASKS = v;
      expect(isSampleTaskSeedingEnabled()).toBe(false);
    }
  });
});
