from __future__ import annotations

from hohobot.agents.orchestrator import OrchestratorAgent
from hohobot.agents.simple import SimpleAgent
from hohobot.config import Settings
from hohobot.engines.ollama import OllamaEngine
from hohobot.observability.opik_client import setup_opik, trace


class HoboBot:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings.from_env()
        self.engine = OllamaEngine(host=self.settings.ollama_host)
        setup_opik(self.settings)

    def ask(self, prompt: str, agent: str = "orchestrator") -> str:
        agent_impl = self._get_agent(agent)
        with trace("hohobot.ask", {"agent": agent, "prompt": prompt}):
            return agent_impl.run(prompt)

    def health(self) -> bool:
        return self.engine.health()

    def _get_agent(self, name: str) -> SimpleAgent:
        if name == "simple":
            return SimpleAgent(self.engine, self.settings.model)
        if name == "orchestrator":
            return OrchestratorAgent(self.engine, self.settings.model)
        raise ValueError(f"Unknown agent: {name}")
