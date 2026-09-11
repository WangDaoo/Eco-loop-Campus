import argparse
import json
import os
from pathlib import Path

import psycopg


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
DATA_PATH = PROJECT_DIR / "data" / "reward_catalog.json"
DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"
VALID_STATUSES = {"active", "inactive"}

if hasattr(os.sys.stdout, "reconfigure"):
    os.sys.stdout.reconfigure(encoding="utf-8")


def load_reward_catalog(data_path=DATA_PATH):
    with Path(data_path).open("r", encoding="utf-8") as data_file:
        return json.load(data_file)


def validate_reward_catalog(catalog):
    categories = catalog.get("categories") if isinstance(catalog, dict) else None
    rewards = catalog.get("rewards") if isinstance(catalog, dict) else None
    if not isinstance(categories, list) or not isinstance(rewards, list):
        raise ValueError("reward_catalog.json phải có categories và rewards")

    category_ids = set()
    for category in categories:
        category_id = str(category.get("id") or "").strip()
        if not category_id or category_id in category_ids:
            raise ValueError(f"id danh mục không hợp lệ hoặc bị trùng: {category_id}")
        if not str(category.get("name") or "").strip():
            raise ValueError(f"Danh mục {category_id} thiếu tên")
        if category.get("status") not in VALID_STATUSES:
            raise ValueError(f"Danh mục {category_id} sai trạng thái")
        category_ids.add(category_id)

    reward_ids = set()
    for reward in rewards:
        reward_id = str(reward.get("id") or "").strip()
        category_id = str(reward.get("category_id") or "").strip()
        cost_points = reward.get("cost_points")
        stock = reward.get("stock")
        if not reward_id or reward_id in reward_ids:
            raise ValueError(f"id sản phẩm không hợp lệ hoặc bị trùng: {reward_id}")
        if category_id not in category_ids:
            raise ValueError(f"Sản phẩm {reward_id} tham chiếu danh mục không tồn tại")
        if not str(reward.get("title") or "").strip():
            raise ValueError(f"Sản phẩm {reward_id} thiếu tên")
        if reward.get("status") not in VALID_STATUSES:
            raise ValueError(f"Sản phẩm {reward_id} sai trạng thái")
        if not isinstance(cost_points, int) or cost_points < 0:
            raise ValueError(f"Sản phẩm {reward_id} sai điểm đổi")
        if stock is not None and (not isinstance(stock, int) or stock < 0):
            raise ValueError(f"Sản phẩm {reward_id} sai tồn kho")
        reward_ids.add(reward_id)

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


def seed_reward_catalog(database_url=None, data_path=DATA_PATH, dry_run=False):
    catalog = validate_reward_catalog(load_reward_catalog(data_path))
    if dry_run:
        return catalog

    with psycopg.connect(load_database_url(database_url)) as connection:
        with connection.cursor() as cursor:
            for category in catalog["categories"]:
                cursor.execute(
                    """
                    insert into reward_categories (id, name, description, status, color, updated_at)
                    values (%s, %s, %s, %s, %s, now())
                    on conflict (id) do update set
                      name = excluded.name,
                      description = excluded.description,
                      status = excluded.status,
                      color = excluded.color,
                      updated_at = now()
                    """,
                    (
                        category["id"],
                        category["name"],
                        category.get("description") or "",
                        category["status"],
                        category.get("color") or "#2F8F5B",
                    ),
                )

            for reward in catalog["rewards"]:
                cursor.execute(
                    """
                    insert into rewards (id, title, description, category_id, category_name, cost_points, stock, status, color, updated_at)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    on conflict (id) do update set
                      title = excluded.title,
                      description = excluded.description,
                      category_id = excluded.category_id,
                      category_name = excluded.category_name,
                      cost_points = excluded.cost_points,
                      stock = excluded.stock,
                      status = excluded.status,
                      color = excluded.color,
                      updated_at = now()
                    """,
                    (
                        reward["id"],
                        reward["title"],
                        reward.get("description") or "",
                        reward["category_id"],
                        reward.get("category_name") or "",
                        reward["cost_points"],
                        reward.get("stock"),
                        reward["status"],
                        reward.get("color") or "#2F8F5B",
                    ),
                )
        connection.commit()
    return catalog


def main():
    parser = argparse.ArgumentParser(description="Seed Eco-loop reward categories and products.")
    parser.add_argument("--database-url", default=None)
    parser.add_argument("--data", default=str(DATA_PATH))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    catalog = seed_reward_catalog(
        database_url=args.database_url,
        data_path=Path(args.data),
        dry_run=args.dry_run,
    )
    mode = "DRY_RUN" if args.dry_run else "SEEDED"
    print(f"[{mode}] Đã xử lý {len(catalog['categories'])} danh mục và {len(catalog['rewards'])} sản phẩm.")
    for category in catalog["categories"]:
        print(f"- Danh mục: {category['name']} ({category['status']})")
    for reward in catalog["rewards"]:
        print(f"- Sản phẩm: {reward['title']} | {reward['cost_points']} điểm | tồn kho {reward.get('stock')}")


if __name__ == "__main__":
    main()
