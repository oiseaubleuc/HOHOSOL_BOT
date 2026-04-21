import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { WorkspaceManager } from "../src/workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../src/modules/system/pathGuard.js";

describe("pathGuard", () => {
  it("resolves safe project names", () => {
    const root = path.join(os.tmpdir(), "ws-guard");
    const ws = new WorkspaceManager(root);
    const p = resolveProjectInWorkspace(ws, "my-app");
    expect(p).toBe(path.join(root, "projects", "my-app"));
  });

  it("rejects traversal names", () => {
    const root = path.join(os.tmpdir(), "ws-guard2");
    const ws = new WorkspaceManager(root);
    expect(() => resolveProjectInWorkspace(ws, "../etc")).toThrow(/Invalid project name/i);
  });
});
