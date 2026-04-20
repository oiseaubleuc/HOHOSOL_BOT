import { describe, expect, it } from "vitest";
import {
  assertCommandsAllowed,
  isLaravelArgvAllowed,
  isNodeArgvAllowed,
  parseExtraAllowedSignatures,
} from "../src/run/allowlist.js";

describe("parseExtraAllowedSignatures", () => {
  it("parses pipe-separated argv prefixes", () => {
    expect(parseExtraAllowedSignatures(["php|artisan|config:clear"])).toEqual([["php", "artisan", "config:clear"]]);
  });
});

describe("isLaravelArgvAllowed", () => {
  it("allows route:list with optional flags", () => {
    expect(isLaravelArgvAllowed(["php", "artisan", "route:list"], [])).toBe(true);
    expect(isLaravelArgvAllowed(["php", "artisan", "route:list", "--json"], [])).toBe(true);
  });

  it("allows test with filters", () => {
    expect(isLaravelArgvAllowed(["php", "artisan", "test", "--filter=Invoice"], [])).toBe(true);
  });

  it("allows migrate --pretend with extra flags", () => {
    expect(isLaravelArgvAllowed(["php", "artisan", "migrate", "--pretend", "--path=database/migrations/foo.php"], [])).toBe(
      true,
    );
  });

  it("blocks arbitrary artisan commands", () => {
    expect(isLaravelArgvAllowed(["php", "artisan", "db:wipe"], [])).toBe(false);
  });

  it("honours extra prefixes from config", () => {
    const extras = parseExtraAllowedSignatures(["php|artisan|config:clear"]);
    expect(isLaravelArgvAllowed(["php", "artisan", "config:clear"], extras)).toBe(true);
  });
});

describe("isNodeArgvAllowed", () => {
  it("allows npm test with safe tail", () => {
    expect(isNodeArgvAllowed(["npm", "test", "--", "unit"], [])).toBe(true);
  });

  it("blocks npm run", () => {
    expect(isNodeArgvAllowed(["npm", "run", "build"], [])).toBe(false);
  });
});

describe("assertCommandsAllowed", () => {
  it("throws for unknown flavor", () => {
    expect(() =>
      assertCommandsAllowed("unknown", [{ argv: ["php", "artisan", "test"] }], []),
    ).toThrow(/unknown/);
  });
});
