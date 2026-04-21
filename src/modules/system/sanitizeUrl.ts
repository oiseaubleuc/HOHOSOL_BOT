const ALLOWED_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "developer.apple.com",
  "nextjs.org",
  "laravel.com",
  "nodejs.org",
  "npmjs.com",
  "openrouter.ai",
  "platform.openai.com",
]);

function isLocalhostUrl(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * Returns a safe https URL string, or throws.
 * Allows http(s) to known doc/social hosts and localhost only.
 */
export function sanitizeBrowserUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty URL");
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isLocalhostUrl(u)) {
    return u.toString();
  }
  const host = u.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Host not allowed: ${host}. Use /browser open url only for approved hosts or localhost.`);
  }
  return u.toString();
}

export function presetUrl(kind: "youtube" | "github"): string {
  if (kind === "youtube") return "https://www.youtube.com/";
  return "https://github.com/";
}

export function localhostUrl(port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid port");
  }
  return `http://127.0.0.1:${port}/`;
}
