import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { runDoctor, collectDoctorLines } from "../src/commands/doctor.js";
import { resetRuntimeConfigForTests } from "../src/config/runtimeConfig.js";

describe("doctor", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests();
  });
  afterEach(() => {
    resetRuntimeConfigForTests();
  });

  it("collectDoctorLines returns at least runtime and workspace lines", async () => {
    const lines = await collectDoctorLines(process.cwd());
    expect(lines.length).toBeGreaterThan(3);
    expect(lines.some((l) => l.message.includes("Node"))).toBe(true);
    expect(lines.some((l) => l.message.includes("WORKSPACE_PATH"))).toBe(true);
    expect(lines.some((l) => l.message.includes("Projects dir"))).toBe(true);
  });

  it("runDoctor exits 0 or 1", async () => {
    const code = await runDoctor(process.cwd());
    expect([0, 1]).toContain(code);
  });
});
