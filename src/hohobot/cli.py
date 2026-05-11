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
    text = bot.ask(prompt=prompt, agent=agent)
    meta = bot.last_meta
    if meta:
        click.echo(f"[{meta['engine']} • {meta['ms']}ms]")
    click.echo(text)


@main.command()
@click.argument("prompt")
def agent(prompt: str) -> None:
    """Claude agent loop with workspace tools (requires ANTHROPIC_API_KEY)."""
    from hohobot.agent.loop import run_agent

    result = run_agent(prompt)
    click.echo(result["answer"])
    click.echo(f"\n[{result['steps']} step(s)]")


@main.command()
@click.option("--host", default="0.0.0.0", show_default=True)
@click.option("--port", default=8000, show_default=True, type=int)
def serve(host: str, port: int) -> None:
    uvicorn.run("hohobot.api.server:app", host=host, port=port, reload=False)


@main.command()
def doctor() -> None:
    settings = Settings.from_env()
    bot = HoboBot(settings=settings)
    click.echo(f"ollama_model={settings.ollama_model}")
    click.echo(f"ollama_host={settings.ollama_host}")
    click.echo(f"default_engine={settings.default_engine}")
    click.echo(f"cloud_provider={settings.cloud_provider}")
    click.echo(f"api_token_configured={'yes' if settings.api_token else 'no'}")
    click.echo(f"opik_enabled={settings.opik_enabled}")
    click.echo(f"health={'ok' if bot.health() else 'degraded'}")
