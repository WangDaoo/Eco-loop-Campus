import argparse
import os
import sys
from pathlib import Path

import psycopg

PROJECT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
RUNTIME_DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

TEST_DATA_CLEANUP_SQL = r"""
delete from point_history
where source = 'utehy_demo_seed'
   or lower(source) like 'e2e%'
   or reference_id like 'TEST-%'
   or reference_id like 'TEST\_%' escape '\'
   or user_id in (select id from users where lower(email) like 'e2e%' or lower(name) like 'e2e%' or lower(email) = 'student.e2e@hyute.edu.vn' or lower(email) like '%.test@hyute.edu.vn' or lower(email) like '%@local.test' or id like 'TEST-%' or id like 'TEST\_%' escape '\' or id like 'UTEHY\_%' escape '\')
   or prediction_id in (select id from predictions where lower(image_name) like 'e2e%' or id like 'TEST-%' or id like 'TEST\_%' escape '\' or id like 'UTEHY\_%' escape '\');
delete from predictions
where lower(image_name) like 'e2e%'
   or lower(source) like 'e2e%'
   or user_id in (select id from users where lower(email) like 'e2e%' or lower(name) like 'e2e%' or lower(email) = 'student.e2e@hyute.edu.vn' or lower(email) like '%.test@hyute.edu.vn' or lower(email) like '%@local.test' or id like 'TEST-%' or id like 'TEST\_%' escape '\' or id like 'UTEHY\_%' escape '\')
   or id like 'TEST-%'
   or id like 'TEST\_%' escape '\'
   or id like 'UTEHY\_%' escape '\';
delete from users
where lower(email) like 'e2e%'
   or lower(name) like 'e2e%'
   or lower(email) = 'student.e2e@hyute.edu.vn'
   or lower(email) like '%.test@hyute.edu.vn'
   or lower(email) like '%@local.test'
   or id like 'TEST-%'
   or id like 'TEST\_%' escape '\'
   or id like 'UTEHY\_%' escape '\';
"""

MOJIBAKE_REPLACEMENTS = {
    "Khoa C? kh? ??ng l?c": "Khoa Cơ khí động lực",
    "Khoa ?i?n ? ?i?n t?": "Khoa Điện - Điện tử",
    "Khoa C?ng ngh? May v? Th?i trang": "Khoa Công nghệ May và Thời trang",
    "Khoa C?ng ngh? H?a h?c v? M?i tr??ng": "Khoa Công nghệ Hóa học và Môi trường",
    "Khoa C?ng ngh? th?ng tin": "Khoa Công nghệ thông tin",
    "Khoa C? kh?": "Khoa Cơ khí",
    "Khoa Kinh t?": "Khoa Kinh tế",
    "Khoa Ngo?i ng?": "Khoa Ngoại ngữ",
    "Khoa S? ph?m K? thu?t": "Khoa Sư phạm Kỹ thuật",
    "Khoa Khoa h?c c? b?n": "Khoa Khoa học cơ bản",
    "Khoa L? lu?n ch?nh tr?": "Khoa Lý luận chính trị",
    "X?c nh?n QR t?i ch?": "Xác nhận QR tái chế",
    "C?ng ?i?m t? giao d?ch QR": "Cộng điểm từ giao dịch QR",
    "?i?u ch?nh": "Điều chỉnh",
    "Nhi?m v?": "Nhiệm vụ",
    "Ho?n th?nh nhi?m v?": "Hoàn thành nhiệm vụ",
    "C?ng ?i?m": "Cộng điểm",
    "giao d?ch": "giao dịch",
    "t?i ch?": "tái chế",
    "c?ng ngh?": "công nghệ",
    "th?ng tin": "thông tin",
}

TEXT_COLUMNS = {
    "users": ["name", "email", "group", "student_code", "faculty_code", "phone_number"],
    "faculties": ["code", "name"],
    "avatar_presets": ["key", "label", "image_url"],
    "bins": ["id", "name", "bin_group", "location", "building", "floor", "qr_code", "status"],
    "waste_types": ["id", "name", "unit", "recycle_method", "status"],
    "predictions": ["id", "class", "source", "bin_group", "status", "image_name", "image_url", "thumbnail_url", "corrected_class"],
    "point_rules": ["id", "label", "bin_group"],
    "feedback": ["id", "user_name", "category", "message", "status", "priority", "admin_note"],
    "reward_categories": ["id", "name", "description", "status", "color"],
    "rewards": ["id", "title", "description", "category_id", "category_name", "status", "color"],
    "missions": ["id", "title", "description", "action_label", "event_type", "status"],
    "point_history": ["class", "bin_group", "action", "admin_note", "source", "description", "status", "reference_type", "reference_id"],
    "reward_redemptions": ["id", "reward_id", "reward_label", "status", "admin_note"],
    "reward_redemption_batches": ["id", "qr_token", "status"],
    "reward_redemption_items": ["id", "batch_id", "reward_id", "reward_title"],
    "recycling_submissions": ["id", "unit", "qr_token", "qr_signature", "status", "volunteer_note", "corrected_class"],
    "qr_scan_logs": ["id", "qr_token", "result", "note"],
    "proof_images": ["id", "image_url", "image_hash", "verification_code", "status", "note"],
    "ai_training_samples": ["id", "original_class", "corrected_class", "image_path", "note", "annotation_status", "export_class"],
}


def fix_mojibake_text(value):
    if value is None:
        return None
    fixed = value
    for broken, correct in MOJIBAKE_REPLACEMENTS.items():
        fixed = fixed.replace(broken, correct)
    return fixed


def resolve_database_url(cli_database_url=None):
    if cli_database_url:
        return cli_database_url
    env_value = os.getenv("DATABASE_URL", "").strip()
    if env_value:
        return env_value
    if RUNTIME_DATABASE_URL_PATH.exists():
        return RUNTIME_DATABASE_URL_PATH.read_text(encoding="utf-8").strip()
    raise SystemExit("[ERROR] Khong tim thay DATABASE_URL. Chay setup server truoc hoac truyen --database-url.")


def table_exists(cursor, table_name):
    cursor.execute(
        """
        select exists (
          select 1 from information_schema.tables
          where table_schema = 'public' and table_name = %s
        )
        """,
        (table_name,),
    )
    return bool(cursor.fetchone()[0])


def existing_columns(cursor, table_name):
    cursor.execute(
        """
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = %s
        """,
        (table_name,),
    )
    return {row[0] for row in cursor.fetchall()}


def select_count(cursor, table_name, where_sql):
    if not table_exists(cursor, table_name):
        return 0
    cursor.execute(f"select count(*) from {table_name} where {where_sql}")
    return int(cursor.fetchone()[0])


def execute_delete(cursor, table_name, where_sql):
    if not table_exists(cursor, table_name):
        return 0
    cursor.execute(f"delete from {table_name} where {where_sql}")
    return cursor.rowcount


def test_user_where():
    return """
    lower(email) like 'e2e%'
    or lower(name) like 'e2e%'
    or lower(email) = 'student.e2e@hyute.edu.vn'
    or lower(email) like '%.test@hyute.edu.vn'
    or lower(email) like '%@local.test'
    or id like 'TEST-%'
    or id like 'TEST\\_%' escape '\\'
    or id like 'UTEHY\\_%' escape '\\'
    """


def test_id_where(extra=None):
    parts = [
        "id like 'TEST-%'",
        "id like 'TEST\\_%' escape '\\'",
        "id like 'UTEHY\\_%' escape '\\'",
    ]
    if extra:
        parts.append(extra)
    return " or ".join(parts)


def reward_catalog_safe_id_where(extra=None):
    parts = [
        "id like 'E2E\\_%' escape '\\'",
        "id like 'TEST-%'",
        "id like 'TEST\\_%' escape '\\'",
    ]
    if extra:
        parts.append(extra)
    return " or ".join(parts)


def delete_specs():
    test_users = test_user_where()
    e2e_qr_tokens = test_id_where("lower(qr_token) like 'e2e%'")
    utehy_submission_tokens = test_id_where("lower(qr_token) like 'e2e%' or qr_token like 'ECL-SUB-UTEHY-%'")
    utehy_station_tokens = test_id_where("lower(qr_token) like 'e2e%' or qr_token like 'ECL-SUB-UTEHY-%' or qr_token like 'ECL-ST-UTEHY-%'")
    e2e_predictions = test_id_where("lower(image_name) like 'e2e%' or lower(source) like 'e2e%' or lower(image_url) like '%e2e%' or lower(image_url) like '%utehy-%'")
    e2e_feedback = test_id_where("lower(user_name) like 'e2e%'")
    e2e_rewards = reward_catalog_safe_id_where("lower(title) like 'e2e%'")
    e2e_reward_categories = reward_catalog_safe_id_where("lower(name) like 'e2e%'")
    return [
        ("point_history", f"source = 'utehy_demo_seed' or lower(source) like 'e2e%' or user_id in (select id from users where {test_users}) or prediction_id in (select id from predictions where lower(image_name) like 'e2e%' or {test_id_where()}) or submission_id in (select id from recycling_submissions where {e2e_qr_tokens})"),
        ("proof_images", f"{test_id_where()} or submission_id in (select id from recycling_submissions where {e2e_qr_tokens}) or lower(image_url) like '%e2e%' or lower(image_url) like '%utehy-%'"),
        ("qr_scan_logs", f"{utehy_station_tokens} or scanned_by in (select id from users where {test_users})"),
        ("mission_events", f"{test_id_where()} or user_id in (select id from users where {test_users}) or mission_id like 'UTEHY\\_%' escape '\\'"),
        ("user_missions", f"{test_id_where()} or user_id in (select id from users where {test_users}) or mission_id like 'UTEHY\\_%' escape '\\'"),
        ("reward_redemption_items", f"{reward_catalog_safe_id_where()} or batch_id in (select id from reward_redemption_batches where {e2e_qr_tokens})"),
        ("reward_redemption_batches", f"{e2e_qr_tokens} or student_id in (select id from users where {test_users})"),
        ("reward_redemptions", f"{reward_catalog_safe_id_where()} or user_id in (select id from users where {test_users})"),
        ("feedback", f"{e2e_feedback} or user_id in (select id from users where {test_users})"),
        ("recycling_submissions", f"{utehy_submission_tokens} or user_id in (select id from users where {test_users}) or bin_id like 'UTEHY\\_%' escape '\\' or waste_type_id like 'UTEHY\\_%' escape '\\'"),
        ("predictions", f"{e2e_predictions} or user_id in (select id from users where {test_users}) or bin_id like 'UTEHY\\_%' escape '\\'"),
        ("rewards", f"{e2e_rewards} or category_id like 'E2E\\_%' escape '\\'"),
        ("reward_categories", e2e_reward_categories),
        ("point_rules", test_id_where()),
        ("missions", test_id_where()),
        ("users", test_users),
        ("bins", test_id_where("qr_code like 'ECL-ST-UTEHY-%'")),
        ("waste_types", test_id_where()),
        ("avatar_presets", "key like 'UTEHY\\_%' escape '\\' or key like 'E2E\\_%' escape '\\' or lower(image_url) like '%utehy-%'"),
    ]


def cleanup_test_data(cursor, dry_run):
    summary = {}
    for table_name, where_sql in delete_specs():
        if dry_run:
            summary[table_name] = select_count(cursor, table_name, where_sql)
        else:
            summary[table_name] = execute_delete(cursor, table_name, where_sql)
    return summary


def repair_mojibake(cursor, dry_run):
    summary = {}
    for table_name, columns in TEXT_COLUMNS.items():
        if not table_exists(cursor, table_name):
            continue
        available = existing_columns(cursor, table_name)
        selected = [column for column in columns if column in available]
        if not selected:
            continue
        select_list = ", ".join(f'"{column}"' for column in selected)
        cursor.execute(f"select ctid, {select_list} from {table_name}")
        changed_rows = []
        for row in cursor.fetchall():
            ctid = row[0]
            updates = {}
            for index, column in enumerate(selected, start=1):
                original = row[index]
                if not isinstance(original, str) or "?" not in original:
                    continue
                fixed = fix_mojibake_text(original)
                if fixed != original:
                    updates[column] = fixed
            if updates:
                changed_rows.append((ctid, updates))

        summary[table_name] = len(changed_rows)
        if dry_run:
            continue
        for ctid, updates in changed_rows:
            assignments = ", ".join(f'"{column}" = %s' for column in updates)
            params = list(updates.values()) + [ctid]
            cursor.execute(f"update {table_name} set {assignments} where ctid = %s", params)
    return summary


def run(database_url=None, dry_run=True):
    target_database_url = resolve_database_url(database_url)
    with psycopg.connect(target_database_url) as connection:
        with connection.cursor() as cursor:
            cleanup_summary = cleanup_test_data(cursor, dry_run=dry_run)
            mojibake_summary = repair_mojibake(cursor, dry_run=dry_run)
        if dry_run:
            connection.rollback()
        else:
            connection.commit()
    return {"cleanup": cleanup_summary, "mojibake": mojibake_summary}


def print_summary(summary, dry_run):
    print("[DRY-RUN] Du lieu se bi xoa/sua:" if dry_run else "[OK] Da cleanup va sua mojibake:")
    print("cleanup:")
    for key, value in sorted(summary["cleanup"].items()):
        if value:
            print(f"- {key}: {value}")
    print("mojibake:")
    for key, value in sorted(summary["mojibake"].items()):
        if value:
            print(f"- {key}: {value}")


def main():
    parser = argparse.ArgumentParser(description="Cleanup test/demo rows and repair known mojibake text in PostgreSQL.")
    parser.add_argument("--database-url", default=None, help="PostgreSQL DATABASE_URL. Defaults to env or .runtime/DATABASE_URL.txt.")
    parser.add_argument("--dry-run", action="store_true", help="Only print target counts.")
    parser.add_argument("--apply", action="store_true", help="Apply delete/update changes.")
    args = parser.parse_args()

    if args.dry_run and args.apply:
        raise SystemExit("[ERROR] Chi dung mot trong hai flag: --dry-run hoac --apply.")
    dry_run = not args.apply
    summary = run(database_url=args.database_url, dry_run=dry_run)
    print_summary(summary, dry_run=dry_run)


if __name__ == "__main__":
    main()
