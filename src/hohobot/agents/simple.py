from __future__ import annotations

from hohobot.engines.base import InferenceEngine


class SimpleAgent:
    name = "simple"

    def __init__(self, engine: InferenceEngine, model: str) -> None:
        self.engine = engine
        self.model = model

    def run(self, user_prompt: str) -> str:
        generation = self.engine.generate(prompt=user_prompt, model=self.model)
        return generation.content
