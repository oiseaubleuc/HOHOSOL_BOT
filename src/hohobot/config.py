from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    model: str = "qwen3:0.6b"
    ollama_host: str = "http://localhost:11434"
    opik_enabled: bool = False
    opik_local: bool = True
    opik_workspace: str | None = None
    opik_api_key: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            model=os.getenv("HOHOBOT_MODEL", "qwen3:0.6b"),
            ollama_host=os.getenv("HOHOBOT_OLLAMA_HOST", "http://localhost:11434"),
            opik_enabled=os.getenv("HOHOBOT_OPIK_ENABLED", "false").lower() == "true",
            opik_local=os.getenv("HOHOBOT_OPIK_LOCAL", "true").lower() == "true",
            opik_workspace=os.getenv("OPIK_WORKSPACE"),
            opik_api_key=os.getenv("OPIK_API_KEY"),
        )
