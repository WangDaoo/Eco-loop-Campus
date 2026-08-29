from pathlib import Path


SCHEMA_PATH = Path(__file__).parent / "local_db" / "schema.sql"
BOOTSTRAP_ADMIN_PATH = Path(__file__).parent / "local_db" / "bootstrap_admin.sql"


def test_local_postgres_schema_is_standalone():
    sql = SCHEMA_PATH.read_text(encoding="utf-8").lower()

    forbidden_supabase_constructs = [
        "auth.uid",
        "auth.jwt",
        "storage.objects",
        "storage.buckets",
        "enable row level security",
        "create policy",
        "supabase_realtime",
    ]
    for forbidden in forbidden_supabase_constructs:
        assert forbidden not in sql


def test_local_postgres_schema_defines_operating_tables_and_rpc():
    sql = SCHEMA_PATH.read_text(encoding="utf-8").lower()

    required_tables = [
        "users",
        "avatar_presets",
        "bins",
        "waste_types",
        "predictions",
        "point_rules",
        "point_history",
        "feedback",
        "settings",
        "rewards",
        "missions",
        "user_missions",
        "reward_redemptions",
        "recycling_submissions",
        "qr_scan_logs",
        "proof_images",
    ]
    for table in required_tables:
        assert f"create table if not exists {table}" in sql

    required_functions = [
        "create_recycling_submission",
        "scan_recycling_qr",
        "confirm_recycling_submission",
        "reject_recycling_submission",
        "request_recycling_review",
    ]
    for function in required_functions:
        assert f"create or replace function {function}" in sql


def test_local_postgres_schema_uses_backend_supplied_actor_ids():
    sql = SCHEMA_PATH.read_text(encoding="utf-8").lower()

    assert "p_user_id text" in sql
    assert "p_volunteer_id text" in sql
    assert "p_scanned_by text" in sql

def test_local_postgres_has_bootstrap_admin_script_without_demo_rows():
    sql = BOOTSTRAP_ADMIN_PATH.read_text(encoding="utf-8").lower()

    assert "insert into users" in sql
    assert "role" in sql
    assert "admin" in sql
    assert "bins" not in sql
    assert "waste_types" not in sql
    assert "rewards" not in sql
    assert "missions" not in sql
