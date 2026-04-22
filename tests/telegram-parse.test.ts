import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "../src/modules/telegram/parseCommand.js";

describe("parseTelegramCommand", () => {
  it("parses /start and strips bot suffix", () => {
    expect(parseTelegramCommand("/start@devBOT_bot")).toEqual({ kind: "start" });
  });

  it("parses /run with id", () => {
    expect(parseTelegramCommand("/run ACME-1842")).toEqual({ kind: "run", taskId: "ACME-1842" });
  });

  it("returns unknown when /run missing id", () => {
    expect(parseTelegramCommand("/run")).toEqual({ kind: "unknown", raw: "/run" });
  });

  it("returns null for non-commands", () => {
    expect(parseTelegramCommand("hello")).toBeNull();
  });

  it("parses /create", () => {
    expect(parseTelegramCommand("/create crm-app saas-template")).toEqual({
      kind: "create",
      name: "crm-app",
      type: "saas-template",
    });
  });

  it("parses /reject", () => {
    expect(parseTelegramCommand("/reject ACME-1842")).toEqual({ kind: "reject", taskId: "ACME-1842" });
  });

  it("parses /open cursor with optional project", () => {
    expect(parseTelegramCommand("/open cursor sample-node")).toEqual({
      kind: "open",
      target: "cursor",
      project: "sample-node",
    });
  });

  it("parses /browser open localhost", () => {
    expect(parseTelegramCommand("/browser open localhost 3000")).toEqual({
      kind: "browser",
      mode: "localhost",
      port: 3000,
    });
  });

  it("parses /system create-folder with name", () => {
    expect(parseTelegramCommand("/system create-folder my-notes")).toEqual({
      kind: "system",
      action: "create-folder",
      folderName: "my-notes",
    });
  });
});
