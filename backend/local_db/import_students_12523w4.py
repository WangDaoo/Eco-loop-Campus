import argparse
import sys
from pathlib import Path

import psycopg

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


CLASS_CODE = "12523W.4"
TEMPORARY_PASSWORD = "123456"

CLASS_STUDENTS = [
    ("10123001", "NGUYỄN VĂN AN"),
    ("10123024", "NGUYỄN THỊ MINH ANH"),
    ("12523003", "PHẠM HUY ANH"),
    ("10123028", "ĐỖ HỮU QUỐC ÁNH"),
    ("12523006", "TRƯƠNG QUÂN BẢO"),
    ("10123053", "BÙI TRÍ DŨNG"),
    ("12523010", "ĐỖ XUÂN DŨNG"),
    ("10123056", "NGUYỄN MẠNH DŨNG"),
    ("12523011", "NGUYỄN VĂN DŨNG"),
    ("10123066", "NGUYỄN QUANG DƯƠNG"),
    ("10123069", "NGUYỄN TÙNG DƯƠNG"),
    ("10122104", "VŨ VĂN DƯƠNG"),
    ("12523014", "LÊ NHẬT DUY"),
    ("12523020", "ĐINH NGỌC ĐẠI"),
    ("10123084", "ĐỖ TIẾN ĐẠT"),
    ("12523022", "HOÀNG TRỌNG ĐẠT"),
    ("10123101", "NGUYỄN VĂN ĐỨC"),
    ("10123105", "TRẦN PHẠM HÀ"),
    ("12523025", "CAO MINH HẢI"),
    ("10623148", "VŨ MINH HÀO"),
    ("10123122", "NGUYỄN ĐỨC HIẾU"),
    ("10123139", "LÊ HUY HOÀNG"),
    ("10123147", "PHẠM HUY HOÀNG"),
    ("12523035", "NGUYỄN THỊ THU HƯỜNG"),
    ("12523033", "ĐÀO MINH HUY"),
    ("10123160", "NGUYỄN ĐỨC HUY"),
    ("10123167", "THÂN ĐỨC HUY"),
    ("10123172", "TRƯƠNG QUANG HUY"),
    ("12523034", "NGUYỄN THỊ HUYỀN"),
    ("12523037", "PHAN VĂN KHÁNH"),
    ("10123196", "TRẦN MAI LAN"),
    ("12523040", "LÊ TIẾN LINH"),
    ("12523044", "NGUYỄN VĂN LONG"),
    ("10123216", "TRẦN ĐỨC LƯƠNG"),
    ("12523055", "LƯU ĐÌNH QUANG MINH"),
    ("12523059", "HOÀNG VĂN NAM"),
    ("10123236", "ĐẶNG THỊ THÙY NGA"),
    ("12523062", "NGÔ MINH NGUYỆT"),
    ("12523064", "NGUYỄN HỮU PHÁP"),
    ("10123257", "NGUYỄN VĂN PHÚC"),
    ("10123264", "ĐÀO MINH QUANG"),
    ("10123294", "NGUYỄN TIẾN THANH"),
    ("12523083", "LƯƠNG VIỆT TIẾN"),
    ("12523088", "ĐINH XUÂN TRƯỜNG"),
    ("10123354", "PHẠM MẠNH TƯỞNG"),
]

STUDENT_UPSERT_SQL = """
insert into users (id, name, email, password_hash, role, "group", status, points, updated_at)
values (%(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(group)s, %(status)s, 0, now())
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status,
  updated_at = now()
returning id
"""


def build_student_records():
    records = []
    for student_code, full_name in CLASS_STUDENTS:
        records.append(
            {
                "id": student_code,
                "name": full_name,
                "email": f"{student_code}@school.edu.vn",
                "password_hash": app.hash_password(TEMPORARY_PASSWORD),
                "role": "student",
                "group": CLASS_CODE,
                "status": "active",
            }
        )
    return records


def upsert_students(database_url=None):
    records = build_student_records()
    target_database_url = database_url or app.require_database_url()
    with psycopg.connect(target_database_url) as connection:
        with connection.cursor() as cursor:
            changed_ids = []
            for record in records:
                cursor.execute(STUDENT_UPSERT_SQL, record)
                changed_ids.append(cursor.fetchone()[0])
        connection.commit()
    return {"count": len(changed_ids), "ids": changed_ids}


def main():
    parser = argparse.ArgumentParser(description="Import students for class 12523W.4 into local PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Print generated accounts without writing database rows.")
    args = parser.parse_args()

    records = build_student_records()
    if args.dry_run:
        for record in records:
            print(f"{record['id']},{record['email']},{record['name']},{record['group']}")
        print(f"DRY_RUN count={len(records)}")
        return

    result = upsert_students()
    print(f"UPSERTED students={result['count']} group={CLASS_CODE} password={TEMPORARY_PASSWORD}")


if __name__ == "__main__":
    main()
