import type { RuntimeConfig } from "../../config/runtimeConfig.js";
import type { ParsedTelegramCommand } from "./types.js";
import { parseTelegramCommand } from "./parseCommand.js";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

function stripCodeFences(s: string): string {
  return s
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function llmSuggestSlashCommand(instruction: string, cfg: RuntimeConfig): Promise<string | undefined> {
  if (!cfg.openaiApiKey) return undefined;
  const model = cfg.openaiModel || cfg.openRouterModel || "gpt-4o-mini";
  const url = cfg.openaiBaseUrl?.trim() || "https://api.openai.com/v1/chat/completions";
  const prompt = [
    "You map one short user message to exactly ONE devBOT slash command for a Mac dev assistant.",
    "Output rules:",
    "- Reply with ONE line only: the slash command, no quotes, no markdown, no explanation.",
    "- If the user did not name a project where one is required, reply exactly: CLARIFY",
    "Allowed roots (examples, not exhaustive):",
    "/quick /tasks /status /health /workspace /pwd",
    "/run <TASK_ID>",
    "/open cursor|vscode|terminal|finder|brave|safari [<project>]",
    "/open settings|activity|music|messages|mail|calendar|notes|… (built-in macOS apps)",
    "/browser open youtube [<search words>]",
    "/browser open github [<search words>]",
    "/browser open localhost <port>|url <https://…>",
    "/dev inspect|build|test|lint|install <project>",
    "/dev git status|diff|branch|commit|push <project> …",
    "/dev file read <project> <path>",
    "/dev artisan <project> …",
    "/system create-folder <name>",
    "/system create-folder-in-future-projects <name>",
    "/kill-port <port>",
    "/tree <project> /files <project>",
  ].join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: instruction.slice(0, 1500) },
      ],
      temperature: 0.05,
      max_tokens: 120,
    }),
  });
  if (!res.ok) return undefined;
  const json = (await res.json()) as OpenAIChatResponse;
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) return undefined;
  return stripCodeFences(raw.split("\n")[0]!.trim());
}

const SAFE_TOKEN = /[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}/;

function firstProjectToken(s: string): string | undefined {
  const m = s.match(/\b(?:project|projet|repo|on|sur|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
  return m?.[1];
}

const YT_TAIL_STOPWORDS = new Set([
  "dans",
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "sur",
  "au",
  "aux",
  "the",
  "a",
  "an",
  "and",
  "or",
  "navigateur",
  "browser",
  "brave",
  "safari",
  "app",
  "application",
]);

function onlyStopwordTail(q: string): boolean {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => YT_TAIL_STOPWORDS.has(w.replace(/['’]/g, "")));
}

/** Natural-language → optional YouTube search text (not a raw URL). */
function extractYoutubeSearchQuery(instruction: string): string | undefined {
  const t = instruction.trim();
  const m1 = t.match(/(?:cherche|search|trouve|regarde)\s+(.+?)\s+(?:sur|on)\s+youtube\b/i);
  if (m1?.[1]?.trim()) return m1[1].trim().slice(0, 500);
  const mSurYt = t.match(/(.+?)\s+sur\s+youtube\b/i);
  if (mSurYt?.[1]?.trim()) {
    let head = mSurYt[1].trim().replace(/^(?:je\s+veux|j'aimerais|ouvre|open|lance|va|aller|montre)\s+/i, "").trim();
    if (head.length >= 2 && !onlyStopwordTail(head)) return head.slice(0, 500);
  }
  const m2 = t.match(/\bsur\s+youtube\s*[,:]?\s*(.+)/i) ?? t.match(/\bon\s+youtube\s*[,:]?\s*(.+)/i);
  if (m2?.[1]?.trim()) return m2[1].trim().slice(0, 500);
  const m3 = t.match(/\byoutube\s*[,:]\s*(.+)/i);
  if (m3?.[1]?.trim()) return m3[1].trim().slice(0, 500);
  const m4 = t.match(/\b(?:youtube|yt)\s+(.+)/i);
  if (m4?.[1]?.trim()) {
    const tail = m4[1].trim();
    if (!onlyStopwordTail(tail)) return tail.slice(0, 500);
  }
  return undefined;
}

function extractGithubSearchQuery(instruction: string): string | undefined {
  const t = instruction.trim();
  const m1 = t.match(/(?:cherche|search|trouve|voir)\s+(.+?)\s+(?:sur|on)\s+github\b/i);
  if (m1?.[1]?.trim()) return m1[1].trim().slice(0, 500);
  const mSurGh = t.match(/(.+?)\s+sur\s+github\b/i);
  if (mSurGh?.[1]?.trim()) {
    let head = mSurGh[1].trim().replace(/^(?:je\s+veux|j'aimerais|ouvre|open|lance|va|aller)\s+/i, "").trim();
    if (head.length >= 2) return head.slice(0, 500);
  }
  const m2 = t.match(/\bsur\s+github\s*[,:]?\s*(.+)/i) ?? t.match(/\bon\s+github\s*[,:]?\s*(.+)/i);
  if (m2?.[1]?.trim()) return m2[1].trim().slice(0, 500);
  const m3 = t.match(/\bgithub\s*[,:]\s*(.+)/i);
  if (m3?.[1]?.trim()) return m3[1].trim().slice(0, 500);
  const m4 = t.match(/\bgithub\s+(.+)/i);
  if (m4?.[1]?.trim()) return m4[1].trim().slice(0, 500);
  return undefined;
}

function heuristicMap(instruction: string): string | undefined {
  const s = instruction.toLowerCase().trim();
  if (!s) return undefined;

  const ytQ = extractYoutubeSearchQuery(instruction);
  if (ytQ) return `/browser open youtube ${ytQ}`;

  const ghQ = extractGithubSearchQuery(instruction);
  if (ghQ) return `/browser open github ${ghQ}`;

  if (/^(quick|feuille|raccourcis)$/i.test(s.trim())) return "/quick";
  if (/\b(tasks|task\s*list|list\s*tasks)\b/.test(s)) return "/tasks";
  if (/\b(réglages|reglages|system\s*settings)\b/.test(s) || (s.includes("settings") && s.includes("mac"))) {
    return "/open settings";
  }
  if (/\bactivity\s*monitor\b/.test(s) || (s.includes("moniteur") && s.includes("activit"))) {
    return "/open activity";
  }
  if (/\b(status|where\s+are\s+we|what'?s\s+running)\b/.test(s)) return "/status";
  if (/\b(health|heartbeat|alive|ping)\b/.test(s)) return "/health";
  if (/\b(workspace|projects\s+folder|pwd)\b/.test(s)) return "/workspace";

  const runM = instruction.match(/^\s*run\s+(\S+)/i) ?? s.match(/\brun\s+(?:task\s+)?([A-Z0-9][A-Z0-9_-]+)\b/i);
  if (runM?.[1]) return `/run ${runM[1].trim()}`;

  if (s.includes("youtube")) return "/browser open youtube";
  if (s.includes("github") && (s.includes("open") || s.includes("browser") || s.includes("brave"))) {
    return "/browser open github";
  }

  if (s.includes("localhost") || /\bport\s+\d+/.test(s)) {
    const m = s.match(/\b(\d{2,5})\b/);
    if (m) return `/browser open localhost ${m[1]}`;
  }

  if (s.includes("cursor")) {
    const m = instruction.match(/(?:sur|on|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1] && SAFE_TOKEN.test(m[1])) return `/dev open cursor ${m[1]}`;
    if (/\bopen\b/.test(s)) return "/open cursor";
  }
  if (s.includes("vscode") || s.includes("vs code")) {
    const m = instruction.match(/(?:sur|on|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1] && SAFE_TOKEN.test(m[1])) return `/dev open vscode ${m[1]}`;
    return "/open vscode";
  }
  if (/\bterminal\b/.test(s)) {
    const m = instruction.match(/(?:sur|on|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1] && SAFE_TOKEN.test(m[1])) return `/open terminal ${m[1]}`;
    return "/open terminal";
  }
  if (/\bfinder\b/.test(s)) {
    const m = instruction.match(/(?:sur|on|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1] && SAFE_TOKEN.test(m[1])) return `/open finder ${m[1]}`;
    return "/open finder";
  }
  if (/\bbrave\b/.test(s) && !s.includes("youtube") && !s.includes("github")) {
    return "/open brave";
  }

  if (/\binspect|what\s+is|stack|detect\b/.test(s)) {
    let name = firstProjectToken(instruction);
    if (!name) {
      const end = instruction.match(/\b([a-zA-Z0-9][a-zA-Z0-9._-]+)\s*$/);
      name = end?.[1];
    }
    if (name && SAFE_TOKEN.test(name)) return `/dev inspect ${name}`;
  }

  if (/\btest(s)?\b/.test(s)) {
    let name = firstProjectToken(instruction);
    if (!name) {
      const m = instruction.match(/\btest\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
      name = m?.[1];
    }
    if (name && SAFE_TOKEN.test(name)) return `/dev test ${name}`;
  }
  if (/\bbuild\b/.test(s)) {
    let name = firstProjectToken(instruction);
    if (!name) {
      const m = instruction.match(/\bbuild\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
      name = m?.[1];
    }
    if (name && SAFE_TOKEN.test(name)) return `/dev build ${name}`;
  }
  if (/\blint\b/.test(s)) {
    let name = firstProjectToken(instruction);
    if (!name) {
      const m = instruction.match(/\blint\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
      name = m?.[1];
    }
    if (name && SAFE_TOKEN.test(name)) return `/dev lint ${name}`;
  }
  if (
    /\binstall\b/.test(s) &&
    (s.includes("npm") || s.includes("dep") || s.includes("package") || s.includes("pnpm") || s.includes("yarn"))
  ) {
    let name = firstProjectToken(instruction);
    if (!name) {
      const m = instruction.match(/\binstall\s+(?:deps?\s+)?(?:in|on|for)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
      name = m?.[1];
    }
    if (name && SAFE_TOKEN.test(name)) return `/dev install ${name}`;
  }

  if (/\b(kill|free)\s+port\b|\bport\s+kill\b/.test(s)) {
    const m = s.match(/\b(\d{2,5})\b/);
    if (m) return `/kill-port ${m[1]}`;
  }

  if (/\btree\b/.test(s)) {
    const m = instruction.match(/\btree\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1]) return `/tree ${m[1]}`;
  }
  if (/\bfiles?\b/.test(s) && s.includes("project")) {
    const m = instruction.match(/(?:project|projet)\s+([a-zA-Z0-9][a-zA-Z0-9._-]*)/i);
    if (m?.[1]) return `/files ${m[1]}`;
  }

  if (/\b(dossier|folder|mkdir)\b/.test(s) || (s.includes("create") && (s.includes("folder") || s.includes("dossier")))) {
    if (s.includes("future") || s.includes("futures")) {
      const m = instruction.match(
        /(?:folder|dossier|mkdir)\s+(?:called\s+|named\s+)?([a-zA-Z0-9][a-zA-Z0-9._\s-]+)/i,
      );
      if (m?.[1]) return `/system create-folder-in-future-projects ${m[1].trim().split(/\s+/).slice(0, 6).join(" ")}`;
    }
    const m =
      instruction.match(/(?:folder|dossier)\s+(?:called\s+|named\s+)?([a-zA-Z0-9][a-zA-Z0-9._\s-]+)/i) ??
      instruction.match(/(?:create|make|crée)\s+([a-zA-Z0-9][a-zA-Z0-9._-]+)\s+(?:folder|dossier)/i);
    if (m?.[1]) {
      const name = m[1].trim().split(/\s+/).slice(0, 6).join(" ");
      if (name.length > 0) return `/system create-folder ${name}`;
    }
  }

  return undefined;
}

function clarifyHint(instruction: string): string {
  const s = instruction.toLowerCase();
  const parts: string[] = [
    "🤔 Une action précise par message (ex. « ouvre Brave », « liste les tâches », « status »). Exemples :",
  ];
  if (s.includes("folder") || s.includes("dossier")) {
    parts.push("• `/system create-folder MyClient`");
    parts.push("• `/system create-folder-in-future-projects portal-v2`");
  }
  if (s.includes("run") || s.includes("task")) {
    parts.push("• `/run ACME-1842` (use an id from `/tasks`)");
  }
  if (s.includes("project") || s.includes("build") || s.includes("test")) {
    parts.push("• `/dev inspect my-app` then `/dev build my-app`");
  }
  if (parts.length === 1) {
    parts.push("• `/status` — see mode + pending approvals");
    parts.push("• `/browser open localhost 3000`");
    parts.push("• `/open cursor my-app`");
  }
  return parts.join("\n");
}

function isValidMapped(m: ParsedTelegramCommand | null | undefined): m is ParsedTelegramCommand {
  return Boolean(m && m.kind !== "unknown" && m.kind !== "ask");
}

export interface AskPlan {
  mapped?: ParsedTelegramCommand;
  slash?: string;
  needsClarification: boolean;
  clarifyMessage?: string;
}

/**
 * Converts natural language into one safe structured command.
 */
export async function planAskInstruction(instruction: string, cfg: RuntimeConfig): Promise<AskPlan> {
  const heuristic = heuristicMap(instruction);
  const llmRaw = await llmSuggestSlashCommand(instruction, cfg).catch(() => undefined);

  const tryParse = (line: string | undefined): ParsedTelegramCommand | null | undefined => {
    if (!line || line === "CLARIFY") return undefined;
    return parseTelegramCommand(line);
  };

  const hMapped = tryParse(heuristic);
  const lMapped = tryParse(llmRaw);

  if (isValidMapped(hMapped)) {
    return { mapped: hMapped, slash: heuristic, needsClarification: false };
  }
  if (isValidMapped(lMapped) && llmRaw) {
    return { mapped: lMapped, slash: llmRaw, needsClarification: false };
  }

  return { needsClarification: true, clarifyMessage: clarifyHint(instruction) };
}
