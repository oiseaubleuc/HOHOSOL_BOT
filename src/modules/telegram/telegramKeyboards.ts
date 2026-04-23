import type { ParsedTelegramCommand } from "./types.js";

/**
 * Clavier persistant : actions regroupées (lisible pour tout le monde, FR + pictos).
 */
export function devBotReplyKeyboard(): unknown {
  return {
    keyboard: [
      [
        { text: "⚡ Quick" },
        { text: "💬 Chat" },
        { text: "❓ Aide" },
        { text: "🧭 Menu" },
      ],
      [
        { text: "📋 Tâches" },
        { text: "📊 Statut" },
        { text: "🩺 Santé" },
      ],
      [
        { text: "🗂 Workspace" },
        { text: "📂 Projets" },
        { text: "📁 Chemin" },
        { text: "🛠 Dev" },
      ],
      [
        { text: "🔌 Ports" },
        { text: "🧩 Processus" },
      ],
      [
        { text: "🎯 Cursor" },
        { text: "📘 VS Code" },
        { text: "🖥 Terminal" },
        { text: "📂 Finder" },
      ],
      [
        { text: "🦁 Brave" },
        { text: "🧭 Safari" },
        { text: "▶️ YouTube" },
        { text: "🐙 GitHub" },
      ],
      [
        { text: "🏠 Local 3000" },
        { text: "⚡ Local 5173" },
      ],
      [
        { text: "⚙️ Réglages" },
        { text: "📈 Moniteur" },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Button or short command for the Mac…",
  };
}

/** Map libellé → commande `/…` */
export function mapReplyKeyboardToCommand(raw: string): string | undefined {
  const t = raw.trim();
  const map: Record<string, string> = {
    "⚡ Quick": "/quick",
    "💬 Chat": "/chat",
    "❓ Aide": "/help",
    "🧭 Menu": "/menu",
    "📋 Tâches": "/tasks",
    "📊 Statut": "/status",
    "🩺 Santé": "/health",
    "🗂 Workspace": "/workspace",
    "📂 Projets": "/projects",
    "📁 Chemin": "/pwd",
    "🛠 Dev": "/dev",
    "🔌 Ports": "/ports",
    "🧩 Processus": "/processes",
    "🎯 Cursor": "/open cursor",
    "📘 VS Code": "/open vscode",
    "🖥 Terminal": "/open terminal",
    "📂 Finder": "/open finder",
    "🦁 Brave": "/open brave",
    "🧭 Safari": "/open safari",
    "▶️ YouTube": "/browser open youtube",
    "🐙 GitHub": "/browser open github",
    "🏠 Local 3000": "/browser open localhost 3000",
    "⚡ Local 5173": "/browser open localhost 5173",
    "⚙️ Réglages": "/open settings",
    "📈 Moniteur": "/open activity",
    "🧭 Menu boutons": "/menu",
    "📁 Chemin WS": "/pwd",
  };
  return map[t];
}

/**
 * Menu inline : mêmes familles + raccourcis (callback_data ≤ 64).
 */
export function devBotInlineMenu(): unknown {
  return {
    inline_keyboard: [
      [
        { text: "⚡ Quick", callback_data: "m:quick" },
        { text: "💬 Chat", callback_data: "m:chat" },
        { text: "❓ Help", callback_data: "m:help" },
        { text: "🔄 Panel", callback_data: "m:menu" },
      ],
      [
        { text: "📋 Tasks", callback_data: "m:tasks" },
        { text: "📊 Status", callback_data: "m:status" },
        { text: "🩺 Health", callback_data: "m:health" },
      ],
      [
        { text: "🗂 Workspace", callback_data: "m:workspace" },
        { text: "📂 Projects", callback_data: "m:projects" },
        { text: "📁 Path", callback_data: "m:pwd" },
        { text: "🛠 Dev", callback_data: "m:dev" },
      ],
      [
        { text: "🔌 Ports", callback_data: "m:ports" },
        { text: "🧩 Processes", callback_data: "m:proc" },
      ],
      [
        { text: "🎯 Cursor", callback_data: "o:cursor" },
        { text: "📘 VS Code", callback_data: "o:vscode" },
        { text: "🖥 Terminal", callback_data: "o:terminal" },
        { text: "📂 Finder", callback_data: "o:finder" },
      ],
      [
        { text: "🦁 Brave", callback_data: "i:brave" },
        { text: "🧭 Safari", callback_data: "i:safari" },
        { text: "▶️ YouTube", callback_data: "b:yt" },
        { text: "🐙 GitHub", callback_data: "b:gh" },
      ],
      [
        { text: "🏠 :3000", callback_data: "b:lc:3000" },
        { text: "⚡ :5173", callback_data: "b:lc:5173" },
        { text: "⚙️ Settings", callback_data: "o:settings" },
        { text: "📈 Activity", callback_data: "o:activity" },
      ],
    ],
  };
}

/** Rappel : le menu inline ne remplace pas le clavier du bas. */
/** Texte au-dessus du pavé inline (FR + EN, sans parse_mode). */
export function inlineMenuIntroText(): string {
  return [
    "🧭 Panneau de contrôle — Control panel (Mac où tourne le listener)",
    "",
    "▸ Aide / Help — Quick · Chat LLM · /help complet",
    "▸ Jobs — Tasks · Status · Health",
    "▸ Chemins / Paths — Workspace · Projects · pwd · Dev (aide CLI)",
    "▸ Système / System — Ports · Processes",
    "▸ IDE — Cursor · VS Code · Terminal · Finder",
    "▸ Web — Brave · Safari · YouTube · GitHub · localhost",
    "▸ macOS — Settings · Activity Monitor",
    "",
    "▸ Clavier du bas / Reply keyboard — boutons persistants ; touche « Panel » = rafraîchir ce menu.",
    "",
    "Texte sans « / » = une action sûre sur le Mac. /chat = conseils uniquement (pas d’exécution).",
  ].join("\n");
}

const INLINE_CALLBACK: Record<string, ParsedTelegramCommand> = {
  "m:quick": { kind: "quick" },
  "m:chat": { kind: "assistant_chat", message: "" },
  "m:help": { kind: "help" },
  "m:menu": { kind: "menu" },
  "m:tasks": { kind: "tasks" },
  "m:status": { kind: "status" },
  "m:health": { kind: "health" },
  "m:workspace": { kind: "workspace" },
  "m:projects": { kind: "projects" },
  "m:ports": { kind: "ports" },
  "m:pwd": { kind: "pwd_ws" },
  "m:proc": { kind: "processes" },
  "m:dev": { kind: "dev", tokens: [] },
  "o:settings": { kind: "open", target: "settings" },
  "o:activity": { kind: "open", target: "activity" },
  "o:cursor": { kind: "open", target: "cursor" },
  "o:vscode": { kind: "open", target: "vscode" },
  "o:terminal": { kind: "open", target: "terminal" },
  "o:finder": { kind: "open", target: "finder" },
  "i:brave": { kind: "open", target: "brave" },
  "i:safari": { kind: "open", target: "safari" },
  "b:yt": { kind: "browser", mode: "youtube" },
  "b:gh": { kind: "browser", mode: "github" },
  "b:lc:3000": { kind: "browser", mode: "localhost", port: 3000 },
  "b:lc:5173": { kind: "browser", mode: "localhost", port: 5173 },
};

export function parseInlineCallbackData(data: string | undefined): ParsedTelegramCommand | null {
  if (!data) return null;
  return INLINE_CALLBACK[data] ?? null;
}
