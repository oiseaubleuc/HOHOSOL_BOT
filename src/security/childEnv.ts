const ALLOWED = new Set(["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "TERM", "LANG"]);

/**
 * Environment for child processes: an allowlist, so bot secrets never reach project scripts.
 */
export function childEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => ALLOWED.has(key) || key.startsWith("LC_")),
  );
}
