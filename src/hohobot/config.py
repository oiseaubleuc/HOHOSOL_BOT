from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(slots=True)
class Settings:
    """HOHOBOT_MODEL kept for backward compat; prefer HOHOBOT_OLLAMA_MODEL."""

    model: str = "qwen2.5:7b-instruct"
    ollama_model: str = "qwen2.5:7b-instruct"
    ollama_host: str = "http://localhost:11434"
    default_engine: str = "local"
    cloud_provider: str = "anthropic"
    local_timeout_s: float = 30.0
    api_token: str | None = None
    opik_enabled: bool = False
    opik_local: bool = True
    opik_workspace: str | None = None
    opik_api_key: str | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        legacy = os.getenv("HOHOBOT_MODEL")
        primary = os.getenv("HOHOBOT_OLLAMA_MODEL") or legacy or "qwen2.5:7b-instruct"
        return cls(
            model=primary,
            ollama_model=primary,
            ollama_host=os.getenv("HOHOBOT_OLLAMA_HOST", "http://localhost:11434"),
            default_engine=os.getenv("HOHOBOT_DEFAULT_ENGINE", "local").lower(),
            cloud_provider=os.getenv("HOHOBOT_CLOUD_PROVIDER", "anthropic").lower(),
            local_timeout_s=float(os.getenv("HOHOBOT_LOCAL_TIMEOUT_S", "30")),
            api_token=os.getenv("HOHOBOT_API_TOKEN") or None,
            opik_enabled=os.getenv("HOHOBOT_OPIK_ENABLED", "false").lower() == "true",
            opik_local=os.getenv("HOHOBOT_OPIK_LOCAL", "true").lower() == "true",
            opik_workspace=os.getenv("OPIK_WORKSPACE"),
            opik_api_key=os.getenv("OPIK_API_KEY"),
        )
