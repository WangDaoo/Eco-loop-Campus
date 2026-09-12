import json
from pathlib import Path

from local_db.seed_waste_types_and_missions import (
    EXPECTED_WASTE_TYPE_IDS,
    load_catalog,
    validate_catalog,
)


def test_waste_type_seed_uses_ai_class_ids_for_mobile_matching():
    catalog = load_catalog()
    validate_catalog(catalog)

    assert [item["id"] for item in catalog["waste_types"]] == EXPECTED_WASTE_TYPE_IDS
    assert {item["id"] for item in catalog["waste_types"]} == {
        "battery",
        "biological",
        "cardboard",
        "clothes",
        "glass",
        "metal",
        "paper",
        "plastic",
        "shoes",
        "trash",
    }
    assert catalog["waste_types"][0]["status"] == "active"


def test_weekly_mission_seed_contains_requested_missions():
    catalog = load_catalog()
    validate_catalog(catalog)

    missions = {item["id"]: item for item in catalog["missions"]}
    assert missions["MISSION_RECYCLE_TODAY"]["title"] == "Gửi rác tái chế hôm nay"
    assert missions["MISSION_RECYCLE_TODAY"]["reward_points"] == 5
    assert missions["MISSION_ORGANIC_TODAY"]["filter_waste_type_id"] == "biological"
    assert missions["MISSION_ORGANIC_TODAY"]["reward_points"] == 3
    assert missions["MISSION_BIN_FULL_REPORT_APPROVED"]["event_type"] == "feedback_bin_full_resolved"
    assert missions["MISSION_BIN_FULL_REPORT_APPROVED"]["reward_points"] == 2
    assert missions["MISSION_GREEN_3_DAY_STREAK"]["target"] == 3
    assert missions["MISSION_GREEN_3_DAY_STREAK"]["reward_points"] == 10


def test_waste_type_mission_catalog_file_is_utf8_json():
    data_path = Path(__file__).resolve().parents[1] / "data" / "waste_types_and_missions.json"
    payload = json.loads(data_path.read_text(encoding="utf-8"))

    assert len(payload["waste_types"]) == 10
    assert len(payload["missions"]) == 4
