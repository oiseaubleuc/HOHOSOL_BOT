from __future__ import annotations

import httpx


def run(query: str) -> str:
    # Free and anonymous endpoint, useful as a minimal default.
    url = "https://duckduckgo.com/?q=" + query.replace(" ", "+")
    with httpx.Client(timeout=10.0) as client:
        response = client.get(url)
        response.raise_for_status()
    return f"Search URL: {url}"
