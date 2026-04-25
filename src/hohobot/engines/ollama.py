from __future__ import annotations

import httpx

from hohobot.engines.base import Generation, InferenceEngine


class OllamaEngine(InferenceEngine):
    name = "ollama"

    def __init__(self, host: str = "http://localhost:11434", timeout_s: float = 120.0) -> None:
        self.host = host.rstrip("/")
        self.timeout_s = timeout_s

    def generate(self, prompt: str, model: str) -> Generation:
        url = f"{self.host}/api/generate"
        payload = {"model": model, "prompt": prompt, "stream": False}
        with httpx.Client(timeout=self.timeout_s) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        text = data.get("response", "").strip()
        return Generation(content=text, model=model, provider=self.name)

    def health(self) -> bool:
        url = f"{self.host}/api/tags"
        with httpx.Client(timeout=5.0) as client:
            response = client.get(url)
            return response.status_code == 200
