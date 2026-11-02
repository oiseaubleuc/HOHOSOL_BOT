from unittest.mock import MagicMock

import pytest

from hohobot.config import Settings
from hohobot.observability import opik_client


@pytest.fixture
def fake_opik(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    fake = MagicMock()
    monkeypatch.setattr(opik_client, "opik", fake)
    monkeypatch.setattr(opik_client, "_enabled", False)
    return fake


def test_no_opik_call_when_setup_not_called(fake_opik: MagicMock) -> None:
    with opik_client.trace("test", {"prompt": "secret"}):
        pass
    assert fake_opik.mock_calls == []


def test_no_opik_call_when_disabled(fake_opik: MagicMock) -> None:
    opik_client.setup_opik(Settings(opik_enabled=False))
    with opik_client.trace("test", {"prompt": "secret"}):
        pass
    assert fake_opik.mock_calls == []


def test_trace_uses_opik_when_enabled(fake_opik: MagicMock) -> None:
    opik_client.setup_opik(Settings(opik_enabled=True))
    with opik_client.trace("test", {"prompt": "hello"}):
        pass
    fake_opik.track.assert_called_once_with(name="test")
