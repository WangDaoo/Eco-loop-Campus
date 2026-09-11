import argparse
import json
import os
from pathlib import Path

import psycopg

if hasattr(os.sys.stdout, "reconfigure"):
    os.sys.stdout.reconfigure(encoding="utf-8")


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
DATA_PATH = PROJECT_DIR / "data" / "point_rules.json"
DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"

EXPECTED_BIN_GROUPS = {
    "battery": "Pin / nguy hại",
    "biological": "Hữu cơ",
    "cardboard": "Tái chế",
    "clothes": "Còn lại",
    "glass": "Tái chế",
    "metal": "Tái chế",
    "paper": "Tái chế",
    "plastic": "Tái chế",
    "shoes": "Còn lại",
    "trash": "Còn lại",
}


def load_point_rules(data_path=DATA_PATH):
    with Path(data_path).open("r", encoding="utf-8") as data_file:
        return json.load(data_file)


def validate_point_rules(rules):
    if not isinstance(rules, list) or len(rules) != len(EXPECTED_BIN_GROUPS):
        raise ValueError("point_rules.json phải có đúng 10 quy tắc")

    seen_keys = set()
    seen_ids = set()
    for rule in rules:
        if not isinstance(rule, dict):
            raise ValueError("Mỗi quy tắc phải là một object JSON")
        rule_id = str(rule.get("id") or "").strip()
        class_keys = rule.get("class_keys")
        points = rule.get("points")
        if not rule_id or rule_id in seen_ids:
            raise ValueError(f"id quy tắc không hợp lệ hoặc bị trùng: {rule_id}")
        if not isinstance(class_keys, list) or len(class_keys) != 1:
            raise ValueError(f"Quy tắc {rule_id} phải có đúng một class_key")
        class_key = str(class_keys[0] or "").strip().lower()
        if class_key not in EXPECTED_BIN_GROUPS or class_key in seen_keys:
            raise ValueError(f"class_key không hợp lệ hoặc bị trùng: {class_key}")
        if str(rule.get("bin_group") or "").strip() != EXPECTED_BIN_GROUPS[class_key]:
            raise ValueError(f"Nhóm thùng sai cho class_key {class_key}")
        if not isinstance(points, int) or points < 0:
            raise ValueError(f"Điểm không hợp lệ cho class_key {class_key}")
        if not isinstance(rule.get("enabled"), bool):
            raise ValueError(f"enabled không hợp lệ cho class_key {class_key}")
        seen_ids.add(rule_id)
        seen_keys.add(class_key)

    missing_keys = set(EXPECTED_BIN_GROUPS) - seen_keys
    if missing_keys:
        raise ValueError(f"Thiếu class_key: {', '.join(sorted(missing_keys))}")
    return rules


def load_database_url(database_url=None):
    if database_url:
        return database_url
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"].strip()
    if not DATABASE_URL_PATH.is_file():
        raise FileNotFoundError(
            f"Không tìm thấy {DATABASE_URL_PATH}. Hãy chạy setup_server_full.bat trước."
        )
    return DATABASE_URL_PATH.read_text(encoding="utf-8").strip()


def seed_point_rules(database_url=None, data_path=DATA_PATH, dry_run=False):
    rules = validate_point_rules(load_point_rules(data_path))
    if dry_run:
        return rules

    with psycopg.connect(load_database_url(database_url)) as connection:
        with connection.cursor() as cursor:
            for rule in rules:
                cursor.execute(
                    """
                    insert into point_rules (id, label, class_keys, bin_group, points, enabled)
                    values (%s, %s, %s, %s, %s, %s)
                    on conflict (id) do update set
                      label = excluded.label,
                      class_keys = excluded.class_keys,
                      bin_group = excluded.bin_group,
                      points = excluded.points,
                      enabled = excluded.enabled
                    """,
                    (
                        rule["id"],
                        rule["label"],
                        rule["class_keys"],
                        rule["bin_group"],
                        rule["points"],
                        rule["enabled"],
                    ),
                )
        connection.commit()
    return rules


def main():
    parser = argparse.ArgumentParser(description="Seed Eco-loop point rules.")
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--data", default=str(DATA_PATH))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    rules = seed_point_rules(
        database_url=args.database_url,
        data_path=Path(args.data),
        dry_run=args.dry_run,
    )
    mode = "DRY_RUN" if args.dry_run else "SEEDED"
    print(f"[{mode}] Đã xử lý {len(rules)} quy tắc điểm.")
    for rule in rules:
        class_key = rule["class_keys"][0]
        state = "bật" if rule["enabled"] else "tắt"
        print(f"- {class_key}: {rule['bin_group']} | {rule['points']} điểm | {state}")


if __name__ == "__main__":
    main()
