from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from hohobot.config import Settings

try:
    import opik
except Exception:  # pragma: no cover
    opik = None

_enabled = False


def setup_opik(settings: Settings) -> None:
    global _enabled
    _enabled = settings.opik_enabled and opik is not None
    if not _enabled:
        return
    if settings.opik_local:
        opik.configure(use_local=True)
        return
    kwargs = {}
    if settings.opik_api_key:
        kwargs["api_key"] = settings.opik_api_key
    if settings.opik_workspace:
        kwargs["workspace"] = settings.opik_workspace
    if kwargs:
        opik.configure(**kwargs)


@contextmanager
def trace(name: str, input_payload: dict) -> Iterator[None]:
    if not _enabled:
        yield
        return

    @opik.track(name=name)
    def _inner(payload: dict) -> None:
        return None

    _inner(input_payload)
    yield
