import argparse
import json
import os
from pathlib import Path

import psycopg

if hasattr(os.sys.stdout, "reconfigure"):
    os.sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
DATA_PATH = PROJECT_DIR / "data" / "waste_types_and_missions.json"
DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"

EXPECTED_WASTE_TYPE_IDS = [
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
]

VALID_STATUSES = {"active", "inactive"}
VALID_MISSION_EVENTS = {
    "submission_confirmed",
    "feedback_created",
    "feedback_bin_full_resolved",
    "prediction_created",
}


def load_catalog(data_path=DATA_PATH):
    with Path(data_path).open("r", encoding="utf-8") as data_file:
        return json.load(data_file)


def _non_empty(value):
    return str(value or "").strip()


def validate_catalog(catalog):
    waste_types = catalog.get("waste_types") if isinstance(catalog, dict) else None
    missions = catalog.get("missions") if isinstance(catalog, dict) else None
    if not isinstance(waste_types, list) or not isinstance(missions, list):
        raise ValueError("waste_types_and_missions.json phải có waste_types và missions")

    ids = []
    for item in waste_types:
        waste_id = _non_empty(item.get("id")).lower()
        if not waste_id:
            raise ValueError("Loại rác thiếu id")
        ids.append(waste_id)
        if not _non_empty(item.get("name")):
            raise ValueError(f"Loại rác {waste_id} thiếu tên")
        if not _non_empty(item.get("unit")):
            raise ValueError(f"Loại rác {waste_id} thiếu đơn vị")
        if item.get("status") not in VALID_STATUSES:
            raise ValueError(f"Loại rác {waste_id} sai trạng thái")
        points = item.get("point_per_unit")
        if not isinstance(points, int) or points < 0:
            raise ValueError(f"Loại rác {waste_id} sai điểm")

    if ids != EXPECTED_WASTE_TYPE_IDS:
        raise ValueError("Danh sách waste_types phải dùng đúng 10 key AI theo thứ tự chuẩn")

    mission_ids = set()
    waste_id_set = set(ids)
    for mission in missions:
        mission_id = _non_empty(mission.get("id"))
        if not mission_id or mission_id in mission_ids:
            raise ValueError(f"Nhiệm vụ thiếu id hoặc trùng id: {mission_id}")
        if not _non_empty(mission.get("title")):
            raise ValueError(f"Nhiệm vụ {mission_id} thiếu tiêu đề")
        if mission.get("status") not in VALID_STATUSES:
            raise ValueError(f"Nhiệm vụ {mission_id} sai trạng thái")
        if mission.get("event_type") not in VALID_MISSION_EVENTS:
            raise ValueError(f"Nhiệm vụ {mission_id} sai event_type")
        if not isinstance(mission.get("target"), int) or mission["target"] <= 0:
            raise ValueError(f"Nhiệm vụ {mission_id} sai target")
        if not isinstance(mission.get("reward_points"), int) or mission["reward_points"] < 0:
            raise ValueError(f"Nhiệm vụ {mission_id} sai điểm thưởng")
        filter_waste_type_id = mission.get("filter_waste_type_id")
        if filter_waste_type_id is not None and filter_waste_type_id not in waste_id_set:
            raise ValueError(f"Nhiệm vụ {mission_id} tham chiếu loại rác không tồn tại")
        mission_ids.add(mission_id)

    return catalog


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


def seed_waste_types_and_missions(database_url=None, data_path=DATA_PATH, dry_run=False):
    catalog = validate_catalog(load_catalog(data_path))
    if dry_run:
        return catalog

    with psycopg.connect(load_database_url(database_url)) as connection:
        with connection.cursor() as cursor:
            for item in catalog["waste_types"]:
                cursor.execute(
                    """
                    insert into waste_types (id, name, unit, point_per_unit, recycle_method, status, updated_at)
                    values (%s, %s, %s, %s, %s, %s, now())
                    on conflict (id) do update set
                      name = excluded.name,
                      unit = excluded.unit,
                      point_per_unit = excluded.point_per_unit,
                      recycle_method = excluded.recycle_method,
                      status = excluded.status,
                      updated_at = now()
                    """,
                    (
                        item["id"],
                        item["name"],
                        item["unit"],
                        item["point_per_unit"],
                        item.get("recycle_method") or "",
                        item["status"],
                    ),
                )

            for mission in catalog["missions"]:
                cursor.execute(
                    """
                    insert into missions
                      (id, title, description, target, reward_points, action_label,
                       event_type, filter_waste_type_id, status, updated_at)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    on conflict (id) do update set
                      title = excluded.title,
                      description = excluded.description,
                      target = excluded.target,
                      reward_points = excluded.reward_points,
                      action_label = excluded.action_label,
                      event_type = excluded.event_type,
                      filter_waste_type_id = excluded.filter_waste_type_id,
                      status = excluded.status,
                      updated_at = now()
                    """,
                    (
                        mission["id"],
                        mission["title"],
                        mission.get("description") or "",
                        mission["target"],
                        mission["reward_points"],
                        mission.get("action_label") or "Tiếp tục",
                        mission["event_type"],
                        mission.get("filter_waste_type_id"),
                        mission["status"],
                    ),
                )
        connection.commit()
    return catalog


def main():
    parser = argparse.ArgumentParser(description="Seed Eco-loop waste types and weekly missions.")
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--data", default=str(DATA_PATH))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    catalog = seed_waste_types_and_missions(
        database_url=args.database_url,
        data_path=Path(args.data),
        dry_run=args.dry_run,
    )
    mode = "DRY_RUN" if args.dry_run else "SEEDED"
    print(f"[{mode}] Đã xử lý {len(catalog['waste_types'])} loại rác và {len(catalog['missions'])} nhiệm vụ.")
    for item in catalog["waste_types"]:
        print(f"- Loại rác: {item['id']} | {item['name']} | {item['point_per_unit']} điểm/{item['unit']} | {item['status']}")
    for mission in catalog["missions"]:
        print(f"- Nhiệm vụ: {mission['title']} | +{mission['reward_points']} điểm | {mission['event_type']}")


if __name__ == "__main__":
    main()
