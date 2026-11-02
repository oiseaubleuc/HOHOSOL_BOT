from pathlib import Path

import pytest

from hohobot.agent import tools


@pytest.fixture
def workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    base = tmp_path / "workspace"
    base.mkdir()
    (base / "note.txt").write_text("hello sandbox\n", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("TOP-SECRET\n", encoding="utf-8")
    sibling = tmp_path / "workspace-evil"
    sibling.mkdir()
    (sibling / "secret.txt").write_text("TOP-SECRET\n", encoding="utf-8")
    (base / "link.txt").symlink_to(tmp_path / "secret.txt")
    monkeypatch.setattr(tools, "WORKSPACE", base)
    return base


@pytest.mark.parametrize(
    "cmd",
    [
        "cat {outside}/secret.txt",
        "cat ../secret.txt",
        "cat ../workspace-evil/secret.txt",
        "cat link.txt",
        "cat '../secret.txt'",
        "cat -",
        "grep TOP-SECRET {outside}/secret.txt",
        "grep -f ../secret.txt note.txt",
        "grep --file=../secret.txt note.txt",
        "grep -f../secret.txt note.txt",
        "find {outside}",
        "find . -exec cat ../secret.txt ;",
        "find . -delete",
        "find -L .",
        "ls {outside}",
        "python3 -c print(open('../secret.txt').read())",
        "node -e console.log(1)",
        "npm run x",
        "pytest",
        "git -C .. log",
        "git status",
        "/bin/cat ../secret.txt",
        "sh -c ls",
        "cat 'unterminated",
    ],
)
def test_run_shell_denies(workspace: Path, cmd: str) -> None:
    result = tools.run_shell(cmd.format(outside=workspace.parent))
    assert result.startswith("DENIED"), result
    assert "TOP-SECRET" not in result


def test_run_shell_denies_cwd_outside(workspace: Path) -> None:
    with pytest.raises(ValueError):
        tools.run_shell("ls", cwd="../workspace-evil")


@pytest.mark.parametrize(
    "cmd, expected",
    [
        ("cat note.txt", "hello sandbox"),
        ("cat -n note.txt", "hello sandbox"),
        ("ls -la", "note.txt"),
        ("grep -n hello note.txt", "hello sandbox"),
        ("grep -ri hello .", "hello sandbox"),
        ("find . -name '*.txt' -type f", "note.txt"),
    ],
)
def test_run_shell_allows_read_only(workspace: Path, cmd: str, expected: str) -> None:
    result = tools.run_shell(cmd)
    assert "[exit 0]" in result
    assert expected in result


def test_grep_recursive_does_not_follow_symlink(workspace: Path) -> None:
    assert "[exit 1]" in tools.run_shell("grep -r TOP-SECRET .")


def test_read_file_rejects_sibling_with_same_prefix(workspace: Path) -> None:
    with pytest.raises(ValueError):
        tools.read_file("../workspace-evil/secret.txt")
