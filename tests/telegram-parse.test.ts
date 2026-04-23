import { describe, expect, it } from "vitest";
import { parseTelegramCommand } from "../src/modules/telegram/parseCommand.js";

describe("parseTelegramCommand", () => {
  it("parses /start and strips bot suffix", () => {
    expect(parseTelegramCommand("/start@devBOT_bot")).toEqual({ kind: "start" });
  });

  it("parses /help", () => {
    expect(parseTelegramCommand("/help")).toEqual({ kind: "help" });
  });

  it("parses /menu", () => {
    expect(parseTelegramCommand("/menu")).toEqual({ kind: "menu" });
  });

  it("parses /quick", () => {
    expect(parseTelegramCommand("/quick")).toEqual({ kind: "quick" });
  });

  it("parses /dev alone as dev with empty tokens (help)", () => {
    expect(parseTelegramCommand("/dev")).toEqual({ kind: "dev", tokens: [] });
  });

  it("parses killport aliases", () => {
    expect(parseTelegramCommand("/killport 8080")).toEqual({ kind: "kill_port", port: 8080 });
    expect(parseTelegramCommand("/kill_port 8080")).toEqual({ kind: "kill_port", port: 8080 });
  });

  it("parses openproject alias", () => {
    expect(parseTelegramCommand("/openproject my-app")).toEqual({ kind: "open_project", name: "my-app" });
  });

  it("parses /chat with message", () => {
    expect(parseTelegramCommand("/chat hello there")).toEqual({
      kind: "assistant_chat",
      message: "hello there",
    });
    expect(parseTelegramCommand("/chat")).toEqual({ kind: "assistant_chat", message: "" });
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

  it("parses /browser open youtube with search words", () => {
    expect(parseTelegramCommand("/browser open youtube rust async")).toEqual({
      kind: "browser",
      mode: "youtube",
      query: "rust async",
    });
  });

  it("parses /open youtube alias with query", () => {
    expect(parseTelegramCommand("/open youtube nextjs tutorial")).toEqual({
      kind: "browser",
      mode: "youtube",
      query: "nextjs tutorial",
    });
  });

  it("parses /system create-folder with name", () => {
    expect(parseTelegramCommand("/system create-folder my-notes")).toEqual({
      kind: "system",
      action: "create-folder",
      folderName: "my-notes",
    });
  });

  it("parses /system create-folder-in-future-projects with name", () => {
    expect(parseTelegramCommand("/system create-folder-in-future-projects client-portal")).toEqual({
      kind: "system",
      action: "create-folder-in-future-projects",
      folderName: "client-portal",
    });
  });

  it("parses /ask natural language", () => {
    expect(parseTelegramCommand("/ask ouvre Brave sur YouTube")).toEqual({
      kind: "ask",
      instruction: "ouvre Brave sur YouTube",
    });
  });

  it("parses /open settings (mac bundle)", () => {
    expect(parseTelegramCommand("/open settings")).toEqual({ kind: "open", target: "settings" });
  });

  it("parses /open system-settings alias", () => {
    expect(parseTelegramCommand("/open system-settings")).toEqual({ kind: "open", target: "settings" });
  });
});
