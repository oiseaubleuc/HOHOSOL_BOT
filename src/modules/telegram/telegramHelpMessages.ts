import type { RuntimeConfig } from "../../config/runtimeConfig.js";

/** First contact — même esprit qu’un bot interne d’équipe (court, actionnable). */
export function devBotStartLines(cfg: RuntimeConfig): string[] {
  return [
    cfg.assistantGreeting,
    "",
    "🛰 Control plane : ce chat pilote le Mac où tourne le listener (`WORKSPACE_PATH`).",
    "⌨️ Reply keyboard (FR) + /menu = bilingual panel · plain text = Mac action · /chat = LLM only",
  ];
}

/** `/quick` — feuille express (boucle dev, commandes les plus utilisées). */
export function devBotQuickSheet(cfg: RuntimeConfig): string {
  return [
    `⚡ ${cfg.assistantName} — quick reference`,
    "",
    "Loop: `/tasks` → `/run <id>` → `/approve <id>` · `/reject <id>`",
    "Mac: `/open brave` · `/browser open youtube …` · `/browser open url …` · `/browser open localhost 3000`",
    "Repo: `/dev` seul = aide · `/dev inspect <proj>` · `/dev build <proj>` · `/open cursor <proj>`",
    "État: `/status` · `/health` · `/workspace` · `/projects` · `/ports` · `/processes`",
    "Texte sans `/` = action sur le Mac (équivalent `/ask`).",
    "`/chat …` = discussion avec le LLM (pas d’exécution) — `OPENAI_API_KEY` requis.",
    "",
    "Plus: `/help` · `/menu`",
  ].join("\n");
}

/** `/help` — aide structurée (doc type bot interne). */
export function devBotHelpFull(cfg: RuntimeConfig): string {
  return [
    `📖 ${cfg.assistantName} — pilotage Mac depuis Telegram`,
    "",
    "▸ Control plane",
    "Tout s’exécute sur la machine où tourne le listener. Tasks/logs = WORKSPACE_PATH.",
    "Chemins : `WORKSPACE_PATH` = contrôle (ex. `~/Documents/HOHOBOT`). Projets : `DEVBOT_PROJECTS_DIR` ou `…/projects` (ex. `~/Documents/HOHOSOL`).",
    "",
    "▸ Jobs agent",
    "`/tasks` · `/run <id>` · `/approve <id>` · `/reject <id>` · `/status`",
    "`/logs <id>` · `/report <id>` · `/kill <id>`",
    "",
    "▸ Mac & navigateur",
    "`/open` brave | cursor | terminal | finder | settings | activity | …",
    "`/browser open youtube` [recherche] · `github` [recherche] · `localhost <port>` · `url <https://…>`",
    "`/system create-folder …` (chemins Bureau autorisés)",
    "",
    "▸ Projets",
    "`/projects` · `/open-project <nom>` · `/pwd` · `/tree <proj>` · `/files <proj>`",
    "`/dev inspect|build|test|lint|install <proj>` · `/dev git …` · `/dev artisan …`",
    "",
    "▸ Langage naturel",
    "Une phrase sans `/` → une commande autorisée sur le Mac (comme `/ask …`).",
    "▸ Conversation LLM",
    "`/chat …` — parler comme avec ChatGPT : explications, code en exemple, zéro exécution automatique. Clé `OPENAI_API_KEY`.",
    "",
    "▸ Autre",
    "`/health` · `/ports` · `/create …` · `/menu` (boutons inline) · `/quick`",
  ].join("\n");
}
