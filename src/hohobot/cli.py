from __future__ import annotations

import click
import uvicorn

from hohobot.app import HoboBot
from hohobot.config import Settings


@click.group()
def main() -> None:
    """HOHOBOT local-first assistant."""


@main.command()
@click.argument("prompt")
@click.option("--agent", default="orchestrator", show_default=True)
def ask(prompt: str, agent: str) -> None:
    bot = HoboBot()
    click.echo(bot.ask(prompt=prompt, agent=agent))


@main.command()
@click.option("--host", default="0.0.0.0", show_default=True)
@click.option("--port", default=8000, show_default=True, type=int)
def serve(host: str, port: int) -> None:
    uvicorn.run("hohobot.api.server:app", host=host, port=port, reload=False)


@main.command()
def doctor() -> None:
    settings = Settings.from_env()
    bot = HoboBot(settings=settings)
    click.echo(f"model={settings.model}")
    click.echo(f"ollama_host={settings.ollama_host}")
    click.echo(f"opik_enabled={settings.opik_enabled}")
    click.echo(f"health={'ok' if bot.health() else 'degraded'}")
