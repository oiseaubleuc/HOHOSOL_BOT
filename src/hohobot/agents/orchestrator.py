from __future__ import annotations

import time

from hohobot.agents.simple import SimpleAgent
from hohobot.agents.types import AgentRunResult
from hohobot.tools import calculator, web_search


class OrchestratorAgent(SimpleAgent):
    name = "orchestrator"

    def run(self, user_prompt: str) -> AgentRunResult:
        stripped = user_prompt.strip()
        if stripped.lower().startswith("calc:"):
            expression = stripped.split(":", 1)[1].strip()
            t0 = time.perf_counter()
            text = calculator.run(expression)
            ms = int((time.perf_counter() - t0) * 1000)
            return text, {"engine": "calc", "ms": ms}
        if stripped.lower().startswith("search:"):
            query = stripped.split(":", 1)[1].strip()
            t0 = time.perf_counter()
            text = web_search.run(query)
            ms = int((time.perf_counter() - t0) * 1000)
            return text, {"engine": "search", "ms": ms}
        return super().run(user_prompt)
