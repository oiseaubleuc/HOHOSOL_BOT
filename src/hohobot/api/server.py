from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from hohobot.app import HoboBot

_WEB_DIR = Path(__file__).resolve().parent.parent / "web_static"

app = FastAPI(title="HOHOBOT API", version="0.1.0")
bot = HoboBot()

if _WEB_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(_WEB_DIR)), name="web_static")


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[Message] = Field(default_factory=list)
    agent: str = "orchestrator"


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
def chat(req: ChatRequest) -> dict:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), None)
    if not last_user:
        raise HTTPException(status_code=400, detail="missing user message")

    content = bot.ask(last_user, agent=req.agent)
    return {
        "id": "chatcmpl-hohobot",
        "object": "chat.completion",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "model": req.model or bot.settings.model,
    }
