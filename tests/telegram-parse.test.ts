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
});
