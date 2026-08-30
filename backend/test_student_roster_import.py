import app
import subprocess
import sys
from pathlib import Path


def test_student_roster_builds_45_active_accounts_with_hashed_passwords():
    from local_db.import_students_12523w4 import build_student_records

    records = build_student_records()

    assert len(records) == 45
    assert len({record["email"] for record in records}) == 45
    assert records[0]["id"] == "10123001"
    assert records[0]["name"] == "NGUYỄN VĂN AN"
    assert records[0]["email"] == "10123001@school.edu.vn"
    assert records[0]["group"] == "12523W.4"
    assert records[0]["role"] == "student"
    assert records[0]["status"] == "active"
    assert records[0]["password_hash"] != "123456"
    assert app.verify_password("123456", records[0]["password_hash"])


def test_student_roster_upsert_uses_email_conflict_and_never_plain_password():
    from local_db.import_students_12523w4 import STUDENT_UPSERT_SQL, build_student_records

    assert "on conflict (email)" in STUDENT_UPSERT_SQL.lower()
    assert "password_hash" in STUDENT_UPSERT_SQL
    assert "123456" not in repr(build_student_records())


def test_student_roster_cli_dry_run_executes_from_script_path():
    script_path = Path(__file__).parent / "local_db" / "import_students_12523w4.py"

    result = subprocess.run(
        [sys.executable, str(script_path), "--dry-run"],
        cwd=Path(__file__).parent,
        check=False,
        capture_output=True,
        encoding="utf-8",
        text=True,
    )

    assert result.returncode == 0
    assert "DRY_RUN count=45" in result.stdout
