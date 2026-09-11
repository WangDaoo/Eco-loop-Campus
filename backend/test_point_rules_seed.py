import json
from pathlib import Path

import pytest

import app
from local_db.seed_point_rules import EXPECTED_BIN_GROUPS, load_point_rules, validate_point_rules


def test_point_rules_use_each_ai_class_key_once_with_matching_bin_group():
    rules = load_point_rules()
    validate_point_rules(rules)

    assert [rule["class_keys"] for rule in rules] == [
        ["battery"],
        ["biological"],
        ["cardboard"],
        ["clothes"],
        ["glass"],
        ["metal"],
        ["paper"],
        ["plastic"],
        ["shoes"],
        ["trash"],
    ]
    assert {
        rule["class_keys"][0]: rule["bin_group"]
        for rule in rules
    } == EXPECTED_BIN_GROUPS


@pytest.mark.parametrize(
    ("class_key", "expected_group"),
    [
        ("battery", "Pin / nguy hại"),
        ("biological", "Hữu cơ"),
        ("cardboard", "Tái chế"),
        ("clothes", "Còn lại"),
        ("glass", "Tái chế"),
        ("metal", "Tái chế"),
        ("paper", "Tái chế"),
        ("plastic", "Tái chế"),
        ("shoes", "Còn lại"),
        ("trash", "Còn lại"),
    ],
)
def test_backend_prediction_group_matches_point_rule_group(class_key, expected_group):
    assert app.prediction_bin_group(class_key) == expected_group


def test_point_rule_data_file_is_utf8_json():
    data_path = Path(__file__).resolve().parents[1] / "data" / "point_rules.json"
    payload = json.loads(data_path.read_text(encoding="utf-8"))

    assert len(payload) == 10
    assert all(isinstance(rule["class_keys"], list) for rule in payload)
