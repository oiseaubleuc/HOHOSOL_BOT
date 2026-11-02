"""
Outils exposés à l'agent. Chaque outil = schéma JSON + fonction Python.
Tous les outils respectent WORKSPACE_PATH (sandbox).
"""

from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path

WORKSPACE = Path(os.path.expanduser(os.getenv("WORKSPACE_PATH", "~/devbot-workspace")))


def _safe_path(rel: str) -> Path:
    base = WORKSPACE.resolve()
    p = (base / rel.lstrip("/")).resolve()
    if not p.is_relative_to(base):
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
        "description": "Exécute une commande en lecture seule dans le workspace : ls, cat, grep ou find",
        "input_schema": {
            "type": "object",
            "properties": {"cmd": {"type": "string"}, "cwd": {"type": "string"}},
            "required": ["cmd"],
        },
    },
]

# Lecture seule : git, npm, node, python3 et pytest peuvent exécuter du code hors du workspace.
ALLOWED_BINARIES = frozenset({"ls", "cat", "grep", "find"})
ALLOWED_SHORT_FLAGS = {"ls": "lah1R", "cat": "n", "grep": "nilcvEFwr"}
ALLOWED_FIND_FLAGS = frozenset({"-name", "-iname", "-type", "-maxdepth", "-mindepth"})


def _flag_allowed(binary: str, flag: str) -> bool:
    if binary == "find":
        return flag in ALLOWED_FIND_FLAGS
    return len(flag) > 1 and set(flag[1:]) <= set(ALLOWED_SHORT_FLAGS[binary])


def read_file(path: str) -> str:
    return _safe_path(path).read_text(encoding="utf-8", errors="replace")[:20000]


def list_dir(path: str = ".") -> str:
    p = _safe_path(path)
    if not p.is_dir():
        return f"Not a directory: {path}"
    return "\n".join(sorted(x.name + ("/" if x.is_dir() else "") for x in p.iterdir()))


def run_shell(cmd: str, cwd: str = ".") -> str:
    try:
        parts = shlex.split(cmd)
    except ValueError as e:
        return f"DENIED: {e}"
    if not parts or parts[0] not in ALLOWED_BINARIES:
        bin_name = parts[0] if parts else ""
        return f"DENIED: binary '{bin_name}' not in allowlist"
    work = _safe_path(cwd)
    base = WORKSPACE.resolve()
    for arg in parts[1:]:
        if arg.startswith("-"):
            if not _flag_allowed(parts[0], arg):
                return f"DENIED: option '{arg}' not allowed for {parts[0]}"
        elif not (work / arg).resolve().is_relative_to(base):
            return f"DENIED: '{arg}' escapes workspace"
    try:
        out = subprocess.run(
            parts, cwd=str(work), stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=60, shell=False
        )
    except subprocess.TimeoutExpired:
        return "TIMEOUT after 60s"
    except Exception as e:
        return f"ERROR: {e}"
    return f"$ {cmd}\n[exit {out.returncode}]\n{out.stdout}\n{out.stderr}"[:8000]


DISPATCH: dict[str, object] = {"read_file": read_file, "list_dir": list_dir, "run_shell": run_shell}
