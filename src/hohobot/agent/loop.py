"""
Boucle agent : modèle décide → outil → résultat → modèle → …
Limite stricte : 8 itérations max. Nécessite ANTHROPIC_API_KEY.
"""

from __future__ import annotations

import os
from typing import Any

from hohobot.agent.tools import DISPATCH, TOOLS

MAX_ITER = 8
SYSTEM = """Tu es un agent développeur. Tu as accès à un workspace sandboxé.
Utilise les outils pour explorer, lire, exécuter. Sois concis.
Quand tu as la réponse finale, réponds en texte sans appeler d'outil."""


def run_agent(user_prompt: str) -> dict[str, Any]:
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required for /agent (Claude tool loop).")

    client = anthropic.Anthropic(api_key=api_key)
    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    messages: list[dict[str, Any]] = [{"role": "user", "content": user_prompt}]
    trace: list[dict[str, Any]] = []

    for step in range(MAX_ITER):
        resp = client.messages.create(
            model=model,
            max_tokens=2048,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        tool_uses = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
            return {"answer": text.strip(), "steps": step + 1, "trace": trace}

        messages.append({"role": "assistant", "content": resp.content})

        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            fn = DISPATCH.get(tu.name)
            inp = getattr(tu, "input", {}) or {}
            try:
                if callable(fn):
                    result = fn(**inp) if isinstance(inp, dict) else fn(inp)
                else:
                    result = f"Unknown tool {tu.name}"
            except Exception as e:
                result = f"ERROR: {e}"
            trace.append({"tool": tu.name, "input": inp, "result": str(result)[:500]})
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": str(result),
                }
            )
        messages.append({"role": "user", "content": tool_results})

    return {"answer": "Limite d'itérations atteinte", "steps": MAX_ITER, "trace": trace}
