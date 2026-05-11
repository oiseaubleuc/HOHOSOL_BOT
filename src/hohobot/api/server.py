from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from hohobot.app import HoboBot
from hohobot.agent.loop import run_agent

_WEB_DIR = Path(__file__).resolve().parent.parent / "web_static"

app = FastAPI(title="HOHOBOT API", version="0.1.0")
bot = HoboBot()

if _WEB_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(_WEB_DIR)), name="web_static")

_api_key_header = APIKeyHeader(name="X-HOHOBOT-Token", auto_error=False)


def require_api_token(x_hohobot_token: Annotated[str | None, Depends(_api_key_header)]) -> None:
    expected = os.getenv("HOHOBOT_API_TOKEN", "").strip()
    if not expected:
        return
    if not x_hohobot_token or x_hohobot_token.strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API token")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[Message] = Field(default_factory=list)
    agent: str = "orchestrator"


class AgentRequest(BaseModel):
    prompt: str = Field(..., min_length=1)


@app.get("/health")
def health() -> dict:
    return {"status": "ok" if bot.health() else "degraded"}


@app.get("/")
def serve_dashboard() -> FileResponse:
    index = _WEB_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return FileResponse(index)


@app.post("/v1/chat/completions")
def chat(req: ChatRequest, _auth: Annotated[None, Depends(require_api_token)]) -> dict[str, Any]:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), None)
    if not last_user:
        raise HTTPException(status_code=400, detail="missing user message")

    content = bot.ask(last_user, agent=req.agent)
    meta = bot.last_meta
    payload: dict[str, Any] = {
        "id": "chatcmpl-hohobot",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "model": req.model or bot.settings.ollama_model,
    }
    if meta:
        payload["hohobot_engine"] = meta.get("engine")
        payload["hohobot_ms"] = meta.get("ms")
        if "local_error" in meta:
            payload["hohobot_local_error"] = meta["local_error"]
        if "cloud_error" in meta:
            payload["hohobot_cloud_error"] = meta["cloud_error"]
    return payload


@app.post("/v1/agent/run")
def agent_run(req: AgentRequest, _auth: Annotated[None, Depends(require_api_token)]) -> dict[str, Any]:
    try:
        return run_agent(req.prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ModuleNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail="Missing dependency: pip install '.[cloud]' (anthropic).",
        ) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
