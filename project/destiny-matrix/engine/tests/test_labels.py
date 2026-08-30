"""Report position labels and interpretation keys are validated as data, not source text."""
from content.source import POINTS, SECTIONS_META
from engine.sections import DEFINITIONS


def test_every_report_position_has_an_existing_interpretation_key():
    expected = {row["key"] for row in POINTS} | {row["key"] for row in SECTIONS_META}
    actual: set[str] = set()
    for section in DEFINITIONS:
        for position in section["positions"]:
            key = position["position_key"]
            assert key in expected, f"{section['key']}: неизвестный position_key {key}"
            actual.add(key)
            if "selector" in position:
                assert position.get("label"), f"{section['key']}: позиция {key} без подписи"
    assert actual <= expected


def test_free_report_rows_keep_labels_and_interpretation_keys_together():
    free = [section for section in DEFINITIONS if section["access"] == "free"]
    assert [section["key"] for section in free] == ["character", "comfort"]
    for section in free:
        for position in section["positions"]:
            assert set(position) >= {"label", "selector", "position_key"}
