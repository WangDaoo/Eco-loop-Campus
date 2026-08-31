import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from local_db.seed_utehy_demo_data import TEMPORARY_PASSWORD, cleanup_demo_database

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Remove UTEHY demo data created by seed_utehy_demo_data.py.")
    parser.add_argument("--dry-run", action="store_true", help="Print target summary without deleting rows.")
    args = parser.parse_args()

    summary = cleanup_demo_database(dry_run=args.dry_run)
    mode = "DRY_RUN cleanup target" if args.dry_run else "REMOVED UTEHY demo data"
    print(mode)
    for key in sorted(summary):
        print(f"- {key}: {summary[key]}")
    print(f"Removed demo accounts that used temporary password: {TEMPORARY_PASSWORD}")


if __name__ == "__main__":
    main()
