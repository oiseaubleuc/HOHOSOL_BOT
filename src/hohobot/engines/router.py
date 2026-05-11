"""
Routeur IA hybride : local par défaut, cloud sur demande ou en fallback.

Règles :
  - Préfixe ``@cloud `` dans le prompt → force cloud
  - Préfixe ``@fast ``  → modèle local rapide (3B)
  - ``HOHOBOT_DEFAULT_ENGINE=cloud`` → cloud par défaut (sauf @fast)
  - Sinon : local (7B), fallback cloud si timeout/erreur et clés présentes
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

import httpx

OLLAMA_HOST = os.getenv("HOHOBOT_OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("HOHOBOT_OLLAMA_MODEL") or os.getenv("HOHOBOT_MODEL", "qwen2.5:7b-instruct")
OLLAMA_FAST = os.getenv("HOHOBOT_OLLAMA_FAST_MODEL", "qwen2.5:3b-instruct")
LOCAL_TIMEOUT = float(os.getenv("HOHOBOT_LOCAL_TIMEOUT_S", "30"))
CLOUD_PROVIDER = os.getenv("HOHOBOT_CLOUD_PROVIDER", "anthropic").lower()
DEFAULT_ENGINE = os.getenv("HOHOBOT_DEFAULT_ENGINE", "local").lower()


def _call_ollama(prompt: str, model: str) -> str:
    url = f"{OLLAMA_HOST.rstrip('/')}/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    with httpx.Client(timeout=LOCAL_TIMEOUT) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
    return str(data.get("response", "")).strip()


def _call_anthropic(prompt: str) -> str:
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    client = anthropic.Anthropic(api_key=api_key)
    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
    msg = client.messages.create(
        model=model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    for block in msg.content:
        if block.type == "text":
            return block.text.strip()
    return ""


def _call_openai(prompt: str) -> str:
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}],
    )
    choice = resp.choices[0].message
    return (choice.content or "").strip()


def _call_cloud(prompt: str) -> str:
    if CLOUD_PROVIDER == "anthropic":
        return _call_anthropic(prompt)
    return _call_openai(prompt)


def _has_cloud_credentials() -> bool:
    if CLOUD_PROVIDER == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    return bool(os.getenv("OPENAI_API_KEY"))


def route_ask(prompt: str, force: Optional[str] = None) -> dict[str, Any]:
    """
    Retourne ``engine``, ``text``, ``ms``, et optionnellement ``local_error``.
    """
    start = time.time()

    def elapsed_ms() -> int:
        return int((time.time() - start) * 1000)

    if prompt.startswith("@cloud "):
        text = _call_cloud(prompt[7:])
        return {"engine": "cloud", "text": text, "ms": elapsed_ms()}

    if prompt.startswith("@fast "):
        text = _call_ollama(prompt[6:], OLLAMA_FAST)
        return {"engine": "fast", "text": text, "ms": elapsed_ms()}

    if force == "cloud":
        text = _call_cloud(prompt)
        return {"engine": "cloud", "text": text, "ms": elapsed_ms()}

    if DEFAULT_ENGINE == "cloud" and not prompt.startswith("@fast "):
        try:
            text = _call_cloud(prompt)
            return {"engine": "cloud", "text": text, "ms": elapsed_ms()}
        except Exception as cloud_err:
            try:
                text = _call_ollama(prompt, OLLAMA_MODEL)
                return {
                    "engine": "local-fallback",
                    "text": text,
                    "ms": elapsed_ms(),
                    "cloud_error": str(cloud_err),
                }
            except Exception:
                raise cloud_err from None

    try:
        text = _call_ollama(prompt, OLLAMA_MODEL)
        return {"engine": "local", "text": text, "ms": elapsed_ms()}
    except Exception as e:
        if _has_cloud_credentials():
            text = _call_cloud(prompt)
            return {
                "engine": "cloud-fallback",
                "text": text,
                "ms": elapsed_ms(),
                "local_error": str(e),
            }
        raise
