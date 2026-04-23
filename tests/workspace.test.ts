import { describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { WorkspaceManager } from "../src/workspace/workspaceManager.js";

describe("WorkspaceManager.assertPathInWorkspace", () => {
  it("allows paths under root", () => {
    const root = path.join(os.tmpdir(), "devbot-ws-test");
    const ws = new WorkspaceManager(root);
    ws.assertPathInWorkspace(path.join(root, "projects", "x"));
  });

  it("rejects escape attempts", () => {
    const root = path.join(os.tmpdir(), "devbot-ws-test2");
    const ws = new WorkspaceManager(root);
    expect(() => ws.assertPathInWorkspace(path.join(root, "..", "etc", "passwd"))).toThrow(/outside workspace/i);
  });

  it("allows project paths under DEVBOT-style external projectsDir", () => {
    const root = path.join(os.tmpdir(), "devbot-ws-ext-root");
    const pd = path.join(os.tmpdir(), "HOHOSOL-projects");
    const ws = new WorkspaceManager(root, { projectsDir: pd });
    expect(ws.projectsDir()).toBe(pd);
    ws.assertPathInWorkspace(path.join(pd, "my-app"));
    ws.assertPathInWorkspace(path.join(pd, "my-app", "src", "index.ts"));
    expect(() => ws.assertPathInWorkspace(path.join(pd, "..", "outside"))).toThrow(/outside workspace/i);
  });
});
