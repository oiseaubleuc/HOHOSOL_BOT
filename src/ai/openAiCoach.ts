/**
 * Optional OpenAI call to summarize failures and suggest next steps (junior-dev style).
 */
export async function coachFailure(input: {
  apiKey?: string;
  taskTitle: string;
  errorText: string;
}): Promise<string | undefined> {
  if (!input.apiKey) return undefined;
  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system" as const,
        content:
          "You are a careful junior developer. Explain what likely went wrong in 2-4 short bullet points, then suggest concrete next steps. Do not suggest destructive shell commands.",
      },
      {
        role: "user" as const,
        content: `Task: ${input.taskTitle}\n\nError / logs:\n${input.errorText.slice(0, 8000)}`,
      },
    ],
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return `OpenAI coach HTTP ${res.status}`;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim();
}
