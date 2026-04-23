import { describe, expect, it } from "vitest";
import { mapReplyKeyboardToCommand, parseInlineCallbackData } from "../src/modules/telegram/telegramKeyboards.js";
import { parseTelegramCommand } from "../src/modules/telegram/parseCommand.js";

describe("telegram keyboards", () => {
  it("maps reply keyboard labels to slash commands", () => {
    expect(mapReplyKeyboardToCommand("📋 Tâches")).toBe("/tasks");
    expect(mapReplyKeyboardToCommand("🧭 Menu")).toBe("/menu");
    expect(mapReplyKeyboardToCommand("🧭 Menu boutons")).toBe("/menu");
    expect(mapReplyKeyboardToCommand("⚡ Quick")).toBe("/quick");
    expect(mapReplyKeyboardToCommand("💬 Chat")).toBe("/chat");
    expect(mapReplyKeyboardToCommand("📁 Chemin WS")).toBe("/pwd");
    expect(mapReplyKeyboardToCommand("🧩 Processus")).toBe("/processes");
    expect(mapReplyKeyboardToCommand("🎯 Cursor")).toBe("/open cursor");
    expect(mapReplyKeyboardToCommand("⚡ Local 5173")).toBe("/browser open localhost 5173");
    expect(mapReplyKeyboardToCommand("🦁 Brave")).toBe("/open brave");
    expect(mapReplyKeyboardToCommand("▶️ YouTube")).toBe("/browser open youtube");
    expect(mapReplyKeyboardToCommand("🏠 Local 3000")).toBe("/browser open localhost 3000");
    expect(mapReplyKeyboardToCommand("random")).toBeUndefined();
  });

  it("parses inline callback_data to ParsedTelegramCommand", () => {
    expect(parseInlineCallbackData("m:quick")).toEqual({ kind: "quick" });
    expect(parseInlineCallbackData("m:chat")).toEqual({ kind: "assistant_chat", message: "" });
    expect(parseInlineCallbackData("m:dev")).toEqual({ kind: "dev", tokens: [] });
    expect(parseInlineCallbackData("m:menu")).toEqual({ kind: "menu" });
    expect(parseInlineCallbackData("m:help")).toEqual({ kind: "help" });
    expect(parseInlineCallbackData("m:tasks")).toEqual({ kind: "tasks" });
    expect(parseInlineCallbackData("b:lc:3000")).toEqual({
      kind: "browser",
      mode: "localhost",
      port: 3000,
    });
    expect(parseInlineCallbackData("b:lc:5173")).toEqual({
      kind: "browser",
      mode: "localhost",
      port: 5173,
    });
    expect(parseInlineCallbackData("m:pwd")).toEqual({ kind: "pwd_ws" });
    expect(parseInlineCallbackData("m:menu")).toEqual({ kind: "menu" });
    expect(parseInlineCallbackData("o:cursor")).toEqual({ kind: "open", target: "cursor" });
    expect(parseInlineCallbackData("unknown")).toBeNull();
  });

  it("chains keyboard label → parseTelegramCommand", () => {
    const slash = mapReplyKeyboardToCommand("❓ Aide");
    expect(slash).toBe("/help");
    expect(parseTelegramCommand(slash!)).toEqual({ kind: "help" });
  });
});
