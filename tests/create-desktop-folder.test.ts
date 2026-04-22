import { describe, expect, it } from "vitest";
import { sanitizeDesktopFolderName } from "../src/modules/system/createDesktopFolder.js";

describe("sanitizeDesktopFolderName", () => {
  it("accepts safe names", () => {
    expect(sanitizeDesktopFolderName("my-notes")).toBe("my-notes");
    expect(sanitizeDesktopFolderName("  Report_v2  ")).toBe("Report_v2");
  });

  it("rejects empty after sanitization", () => {
    expect(() => sanitizeDesktopFolderName("@@@")).toThrow(/empty/i);
  });

  it("rejects names with traversal remnants", () => {
    expect(() => sanitizeDesktopFolderName("..")).toThrow();
  });
});
