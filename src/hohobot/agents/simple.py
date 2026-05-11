from __future__ import annotations

from hohobot.agents.types import AgentRunResult
from hohobot.engines.base import InferenceEngine
from hohobot.engines.router import route_ask


class SimpleAgent:
    name = "simple"

    def __init__(self, engine: InferenceEngine, model: str) -> None:
        self.engine = engine
        self.model = model

    def run(self, user_prompt: str) -> AgentRunResult:
        result = route_ask(user_prompt)
        meta: dict = {"engine": result["engine"], "ms": result["ms"]}
        if "local_error" in result:
            meta["local_error"] = result["local_error"]
        if "cloud_error" in result:
            meta["cloud_error"] = result["cloud_error"]
        return result["text"], meta
