import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WorkspaceManager } from "../src/workspace/workspaceManager.js";
import { resolveProjectInWorkspace } from "../src/modules/system/pathGuard.js";
import { handleExtendedTelegramCommand } from "../src/modules/developer-control/telegramBridge.js";
import { approveDevAction, listPendingDevActions, rejectDevAction } from "../src/modules/developer-control/actionQueue.js";
import { runBounded } from "../src/run/boundedSpawn.js";
import { childEnv } from "../src/security/childEnv.js";

let base: string;
let ws: WorkspaceManager;
let demo: string;
let marker: string;

async function dev(tokens: string[], overrides: { dryRun?: boolean } = {}): Promise<string> {
  const out: string[] = [];
  const client = {
    async sendMessage(_: number | string, t: string) {
      out.push(t);
    },
  };
  const cfg = { workspacePath: ws.root, dryRun: false, autoApprove: false, ...overrides } as never;
  await handleExtendedTelegramCommand({ kind: "dev", tokens } as never, { ws, cfg, client, chatId: 1 });
  return out.join("\n");
}

const exists = (p: string) => fs.stat(p).then(() => true, () => false);

beforeEach(async () => {
  base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "bot-security-")));
  ws = new WorkspaceManager(path.join(base, "ws"));
  await ws.ensureLayout();
  demo = path.join(ws.projectsDir(), "demo");
  marker = path.join(base, "script-ran");
  await fs.mkdir(demo);
  const script = `node -e "require('fs').writeFileSync(process.argv[1], String(process.env.TELEGRAM_BOT_TOKEN))" ${marker}`;
  await fs.writeFile(
    path.join(demo, "package.json"),
    JSON.stringify({ name: "demo", scripts: { test: script, build: script, lint: script } }),
  );
  await fs.writeFile(path.join(demo, "package-lock.json"), "{}");
  await fs.writeFile(path.join(base, "secret.txt"), "OUTSIDE-CONTENT");
});

afterEach(async () => {
  for (const p of listPendingDevActions()) rejectDevAction(p.id);
  delete process.env.TELEGRAM_BOT_TOKEN;
  await fs.rm(base, { recursive: true, force: true });
});

describe("/dev build|test|lint", () => {
  it.each(["build", "test", "lint"])("%s waits for approval before running project code", async (sub) => {
    const reply = await dev([sub, "demo"]);
    expect(reply).toContain("/approve DEV-");
    expect(await exists(marker)).toBe(false);
  });

  it.each(["build", "test", "lint"])("%s is skipped by DRY_RUN", async (sub) => {
    const reply = await dev([sub, "demo"], { dryRun: true });
    expect(reply).toContain("DRY_RUN");
    expect(listPendingDevActions()).toHaveLength(0);
    expect(await exists(marker)).toBe(false);
  });

  it("runs once approved, without bot secrets in the environment", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "FAKE-SECRET";
    await dev(["test", "demo"]);
    const [pending] = listPendingDevActions();
    const res = await approveDevAction(pending!.id);
    expect(res?.success).toBe(true);
    expect(await fs.readFile(marker, "utf8")).toBe("undefined");
  });
});

describe("/dev artisan", () => {
  beforeEach(() => fs.writeFile(path.join(demo, "artisan"), "<?php\n"));

  it.each([["tinker", "--execute=evil"], ["migrate:fresh"], ["db:wipe"], ["migrate"]])(
    "refuses %s",
    async (...tail) => {
      const reply = await dev(["artisan", "demo", ...tail]);
      expect(reply).toContain("⛔");
      expect(listPendingDevActions()).toHaveLength(0);
    },
  );

  it("queues an allowed subcommand for approval, with its arguments visible", async () => {
    const reply = await dev(["artisan", "demo", "route:list", "--json"]);
    expect(reply).toContain("/approve DEV-");
    expect(listPendingDevActions()[0]!.summary).toContain("route:list --json");
  });

  it("is skipped by DRY_RUN", async () => {
    expect(await dev(["artisan", "demo", "route:list"], { dryRun: true })).toContain("DRY_RUN");
    expect(listPendingDevActions()).toHaveLength(0);
  });
});

describe("symlinks", () => {
  it("refuses a file link pointing outside the workspace", async () => {
    await fs.symlink(path.join(base, "secret.txt"), path.join(demo, "link.txt"));
    await expect(dev(["file", "read", "demo", "link.txt"])).rejects.toThrow(/outside workspace/i);
  });

  it("refuses a project that is a link outside the workspace", async () => {
    await fs.symlink(base, path.join(ws.projectsDir(), "linked"));
    expect(() => resolveProjectInWorkspace(ws, "linked")).toThrow(/outside/i);
  });

  it("refuses a project that is a link to workspace state", async () => {
    await fs.symlink(ws.stateDir(), path.join(ws.projectsDir(), "state"));
    expect(() => resolveProjectInWorkspace(ws, "state")).toThrow(/outside/i);
  });

  it("refuses a link to another location of the workspace", async () => {
    await fs.writeFile(path.join(ws.stateDir(), "session"), "SESSION");
    await fs.symlink(path.join(ws.stateDir(), "session"), path.join(demo, "s.txt"));
    await expect(dev(["file", "read", "demo", "s.txt"])).rejects.toThrow(/outside project/i);
  });

  it("refuses a dangling link", async () => {
    await fs.symlink(path.join(base, "not-yet"), path.join(demo, "dangling"));
    expect(() => ws.assertPathInWorkspace(path.join(demo, "dangling"))).toThrow(/dangling/i);
  });

  it("still accepts a workspace that is itself reached through a link", async () => {
    const alias = path.join(base, "alias");
    await fs.symlink(ws.root, alias);
    const viaAlias = new WorkspaceManager(alias);
    expect(() => resolveProjectInWorkspace(viaAlias, "demo")).not.toThrow();
    expect(() => viaAlias.assertPathInWorkspace(path.join(ws.root, "logs", "new.log"))).not.toThrow();
  });
});

describe("/dev file read", () => {
  it.each([".env", ".ENV", ".env.local", "sub/.env", ".git/config", ".npmrc", "server.pem", "id_rsa"])(
    "refuses %s",
    async (rel) => {
      await fs.mkdir(path.dirname(path.join(demo, rel)), { recursive: true });
      await fs.writeFile(path.join(demo, rel), "PROJECT-SECRET");
      await expect(dev(["file", "read", "demo", rel])).rejects.toThrow(/sensitive/i);
    },
  );

  it("refuses an innocent-looking link to a sensitive file of the project", async () => {
    await fs.writeFile(path.join(demo, ".env"), "PROJECT-SECRET");
    await fs.symlink(path.join(demo, ".env"), path.join(demo, "notes.txt"));
    await expect(dev(["file", "read", "demo", "notes.txt"])).rejects.toThrow(/sensitive/i);
  });

  it("reads ordinary files and env templates", async () => {
    await fs.writeFile(path.join(demo, ".env.example"), "KEY=");
    await fs.writeFile(path.join(demo, "README.md"), "hello");
    expect(await dev(["file", "read", "demo", ".env.example"])).toContain("KEY=");
    expect(await dev(["file", "read", "demo", "README.md"])).toContain("hello");
  });
});

describe("runBounded", () => {
  const node = process.execPath;

  it("kills the whole process group on timeout", async () => {
    const pidFile = path.join(base, "grandchild.pid");
    const inner = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(()=>{},1000)`;
    const outer = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(inner)}],{stdio:'inherit'}); setInterval(()=>{},1000)`;
    const r = await runBounded([node, "-e", outer], base, 1000);
    expect(r.exitCode).toBeNull();
    expect(r.stderr).toContain("Timed out");
    const pid = Number(await fs.readFile(pidFile, "utf8"));
    await new Promise((done) => setTimeout(done, 200));
    expect(() => process.kill(pid, 0)).toThrow();
  }, 15000);

  it("returns when a process that left the group keeps the pipes open", async () => {
    const stubborn = "setInterval(()=>{},1000)";
    const outer = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(stubborn)}],{stdio:'inherit',detached:true}).unref(); setInterval(()=>{},1000)`;
    const r = await runBounded([node, "-e", outer], base, 500);
    expect(r.exitCode).toBeNull();
    expect(r.durationMs).toBeLessThan(10000);
  }, 15000);

  it("caps output and closes stdin", async () => {
    const big = "process.stdout.write('x'.repeat(5000000))";
    expect((await runBounded([node, "-e", big], base)).stdout.length).toBeLessThan(2_000_000);
    const read = "process.stdin.on('data',()=>{}).on('end',()=>console.log('eof'))";
    expect((await runBounded([node, "-e", read], base, 5000)).stdout).toContain("eof");
  });

  it("reports a missing binary", async () => {
    const r = await runBounded(["definitely-not-a-binary"], base);
    expect(r.exitCode).toBeNull();
    expect(r.stderr).toContain("ENOENT");
  });
});

describe("childEnv", () => {
  it("keeps only the allowlist", () => {
    process.env.TELEGRAM_BOT_TOKEN = "FAKE-SECRET";
    const env = childEnv();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.PATH).toBe(process.env.PATH);
    expect(Object.keys(env).every((k) => /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TERM|LANG|LC_.*)$/.test(k))).toBe(true);
  });
});
