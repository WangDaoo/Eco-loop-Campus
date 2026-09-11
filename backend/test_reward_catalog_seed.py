import json
from pathlib import Path

from local_db.seed_reward_catalog import load_reward_catalog, validate_reward_catalog


def test_reward_catalog_seed_contains_old_categories_and_products():
    catalog = load_reward_catalog()
    validate_reward_catalog(catalog)

    assert [category["id"] for category in catalog["categories"]] == [
        "UTEHY_REWARD_CAT_FOOD",
        "UTEHY_REWARD_CAT_STUDY",
        "UTEHY_REWARD_CAT_TRANSPORT",
        "UTEHY_REWARD_CAT_GREEN",
        "UTEHY_REWARD_CAT_BADGE",
    ]
    assert [reward["id"] for reward in catalog["rewards"]] == [
        "UTEHY_REWARD_CANTEEN_20K",
        "UTEHY_REWARD_PARKING",
        "UTEHY_REWARD_NOTEBOOK",
        "UTEHY_REWARD_BOTTLE",
        "UTEHY_REWARD_BADGE",
        "UTEHY_REWARD_BOOKSTORE",
    ]


def test_reward_catalog_products_reference_existing_categories():
    catalog = load_reward_catalog()
    category_ids = {category["id"] for category in catalog["categories"]}

    assert all(reward["category_id"] in category_ids for reward in catalog["rewards"])
    assert all(reward["category_name"] for reward in catalog["rewards"])


def test_reward_catalog_data_file_is_utf8_json():
    data_path = Path(__file__).resolve().parents[1] / "data" / "reward_catalog.json"
    payload = json.loads(data_path.read_text(encoding="utf-8"))

    assert len(payload["categories"]) == 5
    assert len(payload["rewards"]) == 6
