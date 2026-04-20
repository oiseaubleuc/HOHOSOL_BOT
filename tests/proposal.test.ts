import { describe, expect, it } from "vitest";
import { buildRunProposal, verifyProposalChecksum } from "../src/run/proposal.js";

describe("buildRunProposal", () => {
  it("computes a stable checksum for identical steps", () => {
    const steps = [
      { label: "a", cwd: "/tmp/proj", argv: ["php", "artisan", "route:list"] as string[] },
    ];
    const p1 = buildRunProposal({ taskId: "T1", projectRoot: "/tmp/proj", steps, dryRun: true });
    const p2 = buildRunProposal({ taskId: "T1", projectRoot: "/tmp/proj", steps, dryRun: false });
    expect(p1.checksum).toBe(p2.checksum);
    expect(verifyProposalChecksum(p1)).toBe(true);
  });

  it("changes checksum when argv changes", () => {
    const a = buildRunProposal({
      taskId: "T1",
      projectRoot: "/tmp",
      steps: [{ label: "x", cwd: "/tmp", argv: ["php", "artisan", "test"] }],
      dryRun: true,
    });
    const b = buildRunProposal({
      taskId: "T1",
      projectRoot: "/tmp",
      steps: [{ label: "x", cwd: "/tmp", argv: ["php", "artisan", "route:list"] }],
      dryRun: true,
    });
    expect(a.checksum).not.toBe(b.checksum);
  });
});
