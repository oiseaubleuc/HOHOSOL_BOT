from hohobot.tools.calculator import run


def test_calc_basic() -> None:
    assert run("2+2") == "4"


def test_calc_power() -> None:
    assert run("2**3") == "8"
