"""
Outils exposés à l'agent. Chaque outil = schéma JSON + fonction Python.
Tous les outils respectent WORKSPACE_PATH (sandbox).
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

WORKSPACE = Path(os.path.expanduser(os.getenv("WORKSPACE_PATH", "~/devbot-workspace")))


def _safe_path(rel: str) -> Path:
    base = WORKSPACE.resolve()
    p = (base / rel.lstrip("/")).resolve()
    if not str(p).startswith(str(base)):
        raise ValueError("Path escapes workspace")
    return p


TOOLS: list[dict] = [
    {
        "name": "read_file",
        "description": "Lit un fichier dans le workspace",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "list_dir",
        "description": "Liste un dossier du workspace",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string", "default": "."}},
        },
    },
    {
        "name": "run_shell",
        "description": "Exécute une commande shell allowlistée dans le workspace",
        "input_schema": {
            "type": "object",
            "properties": {"cmd": {"type": "string"}, "cwd": {"type": "string"}},
            "required": ["cmd"],
        },
    },
]

ALLOWED_BINARIES = frozenset({"ls", "cat", "git", "npm", "node", "python3", "pytest", "grep", "find"})


def read_file(path: str) -> str:
    return _safe_path(path).read_text(encoding="utf-8", errors="replace")[:20000]


def list_dir(path: str = ".") -> str:
    p = _safe_path(path)
    if not p.is_dir():
        return f"Not a directory: {path}"
    return "\n".join(sorted(x.name + ("/" if x.is_dir() else "") for x in p.iterdir()))


def run_shell(cmd: str, cwd: str = ".") -> str:
    parts = cmd.split()
    if not parts or parts[0] not in ALLOWED_BINARIES:
        bin_name = parts[0] if parts else ""
        return f"DENIED: binary '{bin_name}' not in allowlist"
    work = _safe_path(cwd)
    try:
        out = subprocess.run(parts, cwd=str(work), capture_output=True, text=True, timeout=60, shell=False)
    except subprocess.TimeoutExpired:
        return "TIMEOUT after 60s"
    except Exception as e:
        return f"ERROR: {e}"
    return f"$ {cmd}\n[exit {out.returncode}]\n{out.stdout}\n{out.stderr}"[:8000]


DISPATCH: dict[str, object] = {"read_file": read_file, "list_dir": list_dir, "run_shell": run_shell}
