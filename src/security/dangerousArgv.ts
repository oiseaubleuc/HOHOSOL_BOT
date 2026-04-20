const DENY_SUBSTRINGS = [
  "rm -rf /",
  "rm -rf /*",
  ":(){:|:&};:",
  "mkfs",
  "> /dev/sd",
  "dd if=",
  "sudo ",
  "sudo\t",
];

/**
 * Blocks obviously destructive patterns in argv (best-effort; shell=false is still required).
 */
export function assertArgvNotDangerous(argv: string[]): void {
  const joined = argv.join(" ").toLowerCase();
  for (const d of DENY_SUBSTRINGS) {
    if (joined.includes(d.toLowerCase())) {
      throw new Error(`Blocked dangerous argv pattern: ${d}`);
    }
  }
}
