from __future__ import annotations

from hohobot.agents.simple import SimpleAgent
from hohobot.tools import calculator, web_search


class OrchestratorAgent(SimpleAgent):
    name = "orchestrator"

    def run(self, user_prompt: str) -> str:
        stripped = user_prompt.strip()
        if stripped.lower().startswith("calc:"):
            expression = stripped.split(":", 1)[1].strip()
            return calculator.run(expression)
        if stripped.lower().startswith("search:"):
            query = stripped.split(":", 1)[1].strip()
            return web_search.run(query)
        return super().run(user_prompt)
