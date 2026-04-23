import type { RuntimeConfig } from "../../config/runtimeConfig.js";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/**
 * Réponse « style ChatGPT » : discussion uniquement, aucune exécution sur le Mac.
 */
export async function runAssistantChat(userMessage: string, cfg: RuntimeConfig): Promise<string> {
  if (!cfg.openaiApiKey) {
    return "🔑 Ajoute `OPENAI_API_KEY` dans `.env` pour utiliser `/chat`.";
  }
  const model = cfg.openaiModel?.trim() || "gpt-4o-mini";
  const url = cfg.openaiBaseUrl?.trim() || "https://api.openai.com/v1/chat/completions";
  const system = [
    "Tu es devBOT, assistant développement (utilisateur sur Telegram, souvent un Mac avec workspace devBOT : tasks, projets, pipelines).",
    "Réponds en français si l’utilisateur écrit en français.",
    "Tu peux expliquer, proposer du code en exemple, déboguer des idées : rien n’est exécuté sur sa machine à partir de ta réponse.",
    "Pour lancer une action sur son Mac (Brave, tâches, terminal…), dis-lui d’utiliser les boutons du bot ou une phrase courte sans `/` (interprétée comme une commande sûre), ou `/ask …`.",
    "Reste utile et structuré ; pas de préambule « en tant qu’IA ».",
  ].join(" ");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage.slice(0, 12000) },
      ],
      temperature: 0.65,
      max_tokens: 2800,
    }),
  });

  const json = (await res.json()) as OpenAIChatResponse;
  if (!res.ok) {
    const err = json.error?.message ?? (await res.text()).slice(0, 200);
    return `❌ API (${res.status}): ${err}`;
  }
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) return "❌ Réponse vide du modèle.";
  return raw;
}
