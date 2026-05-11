from __future__ import annotations

from typing import Any, TypedDict


class RouteMeta(TypedDict, total=False):
    engine: str
    ms: int
    local_error: str
    cloud_error: str


AgentRunResult = tuple[str, RouteMeta | None]
