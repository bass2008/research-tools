"""Pure checks for local/remote targeting; never run Docker, SSH or a release."""
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("e2e_target", ROOT / "e2e/target.py")
target = importlib.util.module_from_spec(spec)
spec.loader.exec_module(target)


@pytest.mark.parametrize("url,remote", [
    ("https://test.arcana-sense.com", True), ("https://test.arcana-sense.ru", True),
    ("https://arcana-sense.com:443/", True), ("http://127.0.0.1:3000", False),
    ("http://localhost:3000", False), ("https://arcana-sense.ru.evil.invalid", False),
    ("http://localhost:3000/?host=arcana-sense.ru", False),
])
def test_remote_target_is_selected_by_exact_hostname(url, remote):
    assert target.is_remote(url) is remote
