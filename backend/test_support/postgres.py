import base64
import hashlib
import os
from pathlib import Path

import psycopg
from psycopg import sql
import pytest
from fastapi.testclient import TestClient


SCHEMA_PATH = Path(__file__).resolve().parents[1] / "local_db" / "schema.sql"
TEST_TABLES = (
    "ai_training_samples",
    "proof_images",
    "qr_scan_logs",
    "point_history",
    "predictions",
    "feedback",
    "reward_redemption_items",
    "reward_redemption_batches",
    "reward_redemptions",
    "user_missions",
    "recycling_submissions",
    "missions",
    "rewards",
    "reward_categories",
    "point_rules",
    "waste_types",
    "bins",
    "avatar_presets",
    "settings",
    "users",
)

SEED_IDS = {
    "admin": "TEST-ADMIN",
    "student_a": "TEST-STUDENT-A",
    "student_b": "TEST-STUDENT-B",
    "volunteer_a": "TEST-VOLUNTEER-A",
    "volunteer_b": "TEST-VOLUNTEER-B",
    "volunteer_pending": "TEST-VOLUNTEER-PENDING",
    "bin_a": "TEST-BIN-A",
    "bin_b": "TEST-BIN-B",
    "waste_plastic": "TEST-WASTE-PLASTIC",
    "waste_paper": "TEST-WASTE-PAPER",
    "reward_voucher": "TEST-REWARD-VOUCHER",
    "reward_bottle": "TEST-REWARD-BOTTLE",
    "mission": "TEST-MISSION",
}


class UnsafeTestDatabaseError(RuntimeError):
    """Raised before a mutating statement can target a non-test database."""


class SecretDatabaseUrl(str):
    """A connection string whose pytest/debug representation never exposes credentials."""

    def __repr__(self):
        return "<TEST_DATABASE_URL>"


def require_test_database_name(database_name):
    normalized = str(database_name or "").strip().lower()
    if not normalized.endswith("_test"):
        raise UnsafeTestDatabaseError(
            f"Refusing PostgreSQL test operation on database {database_name!r}; "
            "the database name must end with '_test'."
        )
    return normalized


def guard_test_connection(connection):
    database_name = connection.execute("select current_database()").fetchone()[0]
    require_test_database_name(database_name)
    return database_name


def apply_schema(database_url):
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with psycopg.connect(database_url, autocommit=True) as connection:
        guard_test_connection(connection)
        connection.execute(schema_sql, prepare=False)


def truncate_test_database(database_url):
    with psycopg.connect(database_url) as connection:
        guard_test_connection(connection)
        statement = sql.SQL("truncate table {} restart identity cascade").format(
            sql.SQL(", ").join(sql.Identifier(table) for table in TEST_TABLES)
        )
        connection.execute(statement)
        connection.commit()


def _test_password_hash(password="TestPass-2026!"):
    iterations = 260_000
    salt = "ecoloop-test-seed"
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("ascii"), iterations
    )
    encoded = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt}${encoded}"


def seed_catalog(database_url):
    password_hash = _test_password_hash()
    users = (
        (SEED_IDS["admin"], "Test Admin", "admin.test@hyute.edu.vn", password_hash, "admin", "Khoa Công nghệ thông tin", 0, "active"),
        (SEED_IDS["student_a"], "Test Student A", "student.a@hyute.edu.vn", password_hash, "student", "Khoa Công nghệ thông tin", 1000, "active"),
        (SEED_IDS["student_b"], "Test Student B", "student.b@hyute.edu.vn", password_hash, "student", "Khoa Cơ khí", 800, "active"),
        (SEED_IDS["volunteer_a"], "Test Volunteer A", "volunteer.a@hyute.edu.vn", password_hash, "volunteer", "Khoa Điện – Điện tử", 0, "active"),
        (SEED_IDS["volunteer_b"], "Test Volunteer B", "volunteer.b@hyute.edu.vn", password_hash, "volunteer", "Khoa Công nghệ Hóa học và Môi trường", 0, "active"),
        (SEED_IDS["volunteer_pending"], "Test Volunteer Pending", "volunteer.pending@hyute.edu.vn", password_hash, "volunteer", "Khoa Kinh tế", 0, "pending"),
    )
    bins = (
        (SEED_IDS["bin_a"], "Test Station A", "Tái chế", "Nhà A", "ECL-ST-TEST-BIN-A", "active", 20),
        (SEED_IDS["bin_b"], "Test Station B", "Hữu cơ", "Nhà B", "ECL-ST-TEST-BIN-B", "active", 30),
    )
    waste_types = (
        (SEED_IDS["waste_plastic"], "Chai nhựa test", "item", 10, "Làm sạch", "active"),
        (SEED_IDS["waste_paper"], "Giấy test", "kg", 20, "Giữ khô", "active"),
    )
    rewards = (
        (SEED_IDS["reward_voucher"], "Voucher test", "Voucher integration test", 100, "active", 3),
        (SEED_IDS["reward_bottle"], "Bình nước test", "Quà integration test", 250, "active", 2),
    )

    with psycopg.connect(database_url) as connection:
        guard_test_connection(connection)
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                insert into users (id, name, email, password_hash, role, "group", points, status)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                users,
            )
            cursor.executemany(
                """
                insert into bins (id, name, bin_group, location, qr_code, status, capacity)
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                bins,
            )
            cursor.executemany(
                """
                insert into waste_types (id, name, unit, point_per_unit, recycle_method, status)
                values (%s, %s, %s, %s, %s, %s)
                """,
                waste_types,
            )
            cursor.executemany(
                """
                insert into rewards (id, title, description, cost_points, status, stock)
                values (%s, %s, %s, %s, %s, %s)
                """,
                rewards,
            )
            cursor.execute(
                """
                insert into missions (id, title, description, target, reward_points, action_label, status)
                values (%s, %s, %s, %s, %s, %s, %s)
                """,
                (SEED_IDS["mission"], "Nhiệm vụ test", "Integration mission", 2, 25, "Đóng góp", "active"),
            )
        connection.commit()
    return dict(SEED_IDS)


def _missing_test_url_is_error():
    values = (os.getenv("CI", ""), os.getenv("REQUIRE_TEST_DATABASE_URL", ""))
    return any(value.strip().lower() in {"1", "true", "yes", "on"} for value in values)


@pytest.fixture(scope="session")
def postgres_test_url():
    database_url = os.getenv("TEST_DATABASE_URL", "").strip()
    if not database_url:
        message = "TEST_DATABASE_URL is required for PostgreSQL integration tests"
        if _missing_test_url_is_error():
            pytest.fail(message, pytrace=False)
        pytest.skip(message)

    with psycopg.connect(database_url, connect_timeout=3) as connection:
        guard_test_connection(connection)
    return SecretDatabaseUrl(database_url)


@pytest.fixture(scope="session")
def postgres_schema(postgres_test_url):
    apply_schema(postgres_test_url)
    return SCHEMA_PATH


@pytest.fixture
def reset_test_database(postgres_test_url, postgres_schema):
    truncate_test_database(postgres_test_url)
    try:
        yield lambda: truncate_test_database(postgres_test_url)
    finally:
        truncate_test_database(postgres_test_url)


@pytest.fixture
def seed_operating_catalog(postgres_test_url, reset_test_database):
    return seed_catalog(postgres_test_url)


@pytest.fixture
def api_client(monkeypatch, postgres_test_url):
    monkeypatch.setenv("DATABASE_URL", postgres_test_url)
    import app as backend_app

    with TestClient(backend_app.app) as client:
        yield client
