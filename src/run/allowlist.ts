/**
 * Central place for command policy. Extend via BotConfig.extraAllowedCommands
 * using serialized "signature" lines: `php|artisan|route:list` style.
 */

const SAFE_FLAG = /^--[a-zA-Z][a-zA-Z0-9\-:=._/]*$/;
const SAFE_POS = /^[a-zA-Z0-9_.\-/@]+$/;

function isSafeTailToken(t: string): boolean {
  return SAFE_FLAG.test(t) || SAFE_POS.test(t) || t === "--";
}

export function parseExtraAllowedSignatures(lines: string[]): string[][] {
  return lines.map((line) => line.split("|").map((s) => s.trim()).filter(Boolean));
}

export function isLaravelArgvAllowed(argv: string[], extraPrefixes: string[][]): boolean {
  if (argv.length < 3) return false;
  if (argv[0] !== "php" || argv[1] !== "artisan") return false;

  const builtins: Array<{ prefix: string[]; allowTail?: (tail: string[]) => boolean }> = [
    {
      prefix: ["php", "artisan", "route:list"],
      allowTail: (tail) => tail.every((t) => SAFE_FLAG.test(t)),
    },
    {
      prefix: ["php", "artisan", "test"],
      allowTail: (tail) => tail.every(isSafeTailToken),
    },
    {
      prefix: ["php", "artisan", "migrate", "--pretend"],
      allowTail: (tail) => tail.every((t) => SAFE_FLAG.test(t)),
    },
  ];

  for (const b of builtins) {
    if (!hasPrefix(argv, b.prefix)) continue;
    const tail = argv.slice(b.prefix.length);
    if (!b.allowTail) return tail.length === 0;
    return b.allowTail(tail);
  }

  for (const prefix of extraPrefixes) {
    if (hasPrefix(argv, prefix) && argv.length >= prefix.length) {
      const tail = argv.slice(prefix.length);
      return tail.every(isSafeTailToken);
    }
  }

  return false;
}

export function isNodeArgvAllowed(argv: string[], extraPrefixes: string[][]): boolean {
  const builtins: Array<{ prefix: string[] }> = [
    { prefix: ["npm", "test"] },
    { prefix: ["pnpm", "test"] },
    { prefix: ["yarn", "test"] },
  ];
  for (const b of builtins) {
    if (!hasPrefix(argv, b.prefix)) continue;
    const tail = argv.slice(b.prefix.length);
    if (!tail.every(isSafeTailToken)) return false;
    return true;
  }
  for (const prefix of extraPrefixes) {
    if (hasPrefix(argv, prefix) && argv.length >= prefix.length) {
      const tail = argv.slice(prefix.length);
      return tail.every(isSafeTailToken);
    }
  }
  return false;
}

function hasPrefix(argv: string[], prefix: string[]): boolean {
  if (argv.length < prefix.length) return false;
  return prefix.every((t, i) => argv[i] === t);
}

export function assertCommandsAllowed(
  flavor: "laravel" | "node" | "unknown",
  steps: { argv: string[] }[],
  extraPrefixes: string[][],
): void {
  if (flavor === "unknown") {
    throw new Error("Cannot execute commands: project flavor is unknown.");
  }
  for (const step of steps) {
    const ok =
      flavor === "laravel"
        ? isLaravelArgvAllowed(step.argv, extraPrefixes)
        : flavor === "node"
          ? isNodeArgvAllowed(step.argv, extraPrefixes)
          : false;
    if (!ok) {
      throw new Error(`Blocked command (not on allowlist): ${JSON.stringify(step.argv)}`);
    }
  }
}
