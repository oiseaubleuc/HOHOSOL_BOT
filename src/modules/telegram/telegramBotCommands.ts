/**
 * Menu « / » natif Telegram (à côté du champ message).
 * `command` : a-z, 0-9, underscore uniquement.
 */
export function defaultBotCommands(): Array<{ command: string; description: string }> {
  return [
    { command: "start", description: "Start + reply keyboard | Démarrer + clavier" },
    { command: "menu", description: "Inline control panel | Pavé vert" },
    { command: "quick", description: "Cheat sheet | Feuille express" },
    { command: "help", description: "Full help | Aide complète" },
    { command: "chat", description: "LLM chat (no exec) | Discussion sans exécution" },
    { command: "ask", description: "NL → one safe action | FR → une action" },
    { command: "tasks", description: "List jobs | Liste des tâches" },
    { command: "run", description: "Run job /run <id> | Lancer un job" },
    { command: "approve", description: "Approve gate /approve <id> | Débloquer" },
    { command: "reject", description: "Reject /reject <id> | Refuser" },
    { command: "status", description: "Pipelines & gates | Pipelines" },
    { command: "health", description: "Worker & paths | Santé worker" },
    { command: "workspace", description: "Control-plane root | Racine workspace" },
    { command: "projects", description: "Project folders | Dossiers projets" },
    { command: "pwd", description: "Print workspace path | Chemin workspace" },
    { command: "ports", description: "Listening TCP ports | Ports TCP" },
    { command: "processes", description: "Process list | Liste processus" },
    { command: "dev", description: "CLI on project /dev … | CLI sur projet" },
    { command: "open", description: "Open app/folder /open … | Ouvrir app" },
    { command: "browser", description: "Brave /browser open … | Navigateur" },
    { command: "logs", description: "Tail log /logs <id> | Journal" },
    { command: "report", description: "Agent report /report <id> | Rapport" },
    { command: "kill", description: "Stop runner /kill <id> | Arrêter job" },
    { command: "killport", description: "Free port /killport <n> | Libérer port" },
    { command: "create", description: "Scaffold /create … | Échafaudage" },
    { command: "openproject", description: "Set active & Finder /openproject …" },
    { command: "tree", description: "Shallow tree /tree <proj> | Arborescence" },
    { command: "files", description: "List files /files <proj> | Fichiers" },
    { command: "system", description: "Desktop folders /system … | Dossiers" },
  ];
}
