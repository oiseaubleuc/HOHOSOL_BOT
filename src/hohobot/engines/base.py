from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Generation:
    content: str
    model: str
    provider: str


class InferenceEngine:
    name = "base"

    def generate(self, prompt: str, model: str) -> Generation:
        raise NotImplementedError
