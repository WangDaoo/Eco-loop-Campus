import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError:
    print("ERROR: psycopg not found.")
    print("Run from project root: backend\\.venv\\Scripts\\pip install -r backend\\requirements.txt")
    sys.exit(1)


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parents[1]
RUNTIME_DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"


def load_database_url():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url:
        return database_url
    if RUNTIME_DATABASE_URL_PATH.is_file():
        return RUNTIME_DATABASE_URL_PATH.read_text(encoding="utf-8").strip()
    return input("Paste PostgreSQL DATABASE_URL: ").strip()


def main():
    database_url = load_database_url()
    if not database_url:
        print("ERROR: DATABASE_URL is required.")
        return 1

    statements = [
        "alter table predictions add column if not exists reviewed_at timestamptz",
        "alter table predictions add column if not exists reviewed_by text references users(id) on delete set null",
    ]

    with psycopg.connect(database_url, autocommit=True) as connection:
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
            cursor.execute(
                """
                select column_name, data_type
                from information_schema.columns
                where table_name = 'predictions'
                  and column_name in ('reviewed_at', 'reviewed_by')
                order by column_name
                """
            )
            rows = cursor.fetchall()

    if {row[0] for row in rows} != {"reviewed_at", "reviewed_by"}:
        print("ERROR: reviewer columns were not found after migration.")
        return 1

    for column_name, data_type in rows:
        print(f"{column_name}: {data_type}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
