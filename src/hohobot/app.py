from __future__ import annotations

from typing import Any

from hohobot.agents.orchestrator import OrchestratorAgent
from hohobot.agents.simple import SimpleAgent
from hohobot.agents.types import RouteMeta
from hohobot.config import Settings
from hohobot.engines.ollama import OllamaEngine
from hohobot.observability.opik_client import setup_opik, trace


class HoboBot:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings.from_env()
        self.engine = OllamaEngine(host=self.settings.ollama_host)
        setup_opik(self.settings)
        self.last_meta: RouteMeta | None = None

    def ask(self, prompt: str, agent: str = "orchestrator") -> str:
        agent_impl = self._get_agent(agent)
        self.last_meta = None
        with trace("hohobot.ask", {"agent": agent, "prompt": prompt}):
            text, meta = agent_impl.run(prompt)
        self.last_meta = meta
        return text

    def ask_full(self, prompt: str, agent: str = "orchestrator") -> dict[str, Any]:
        content = self.ask(prompt=prompt, agent=agent)
        out: dict[str, Any] = {"content": content, "meta": self.last_meta}
        return out

    def health(self) -> bool:
        return self.engine.health()

    def _get_agent(self, name: str) -> SimpleAgent:
        model = self.settings.ollama_model
        if name == "simple":
            return SimpleAgent(self.engine, model)
        if name == "orchestrator":
            return OrchestratorAgent(self.engine, model)
        raise ValueError(f"Unknown agent: {name}")
