import psycopg
import pytest

from test_support.postgres import (
    SEED_IDS,
    UnsafeTestDatabaseError,
    apply_schema,
    require_test_database_name,
)


pytestmark = pytest.mark.postgres


def test_database_name_guard_rejects_non_test_database():
    with pytest.raises(UnsafeTestDatabaseError, match="must end with '_test'"):
        require_test_database_name("ecoloop_campus")


def test_schema_is_idempotent(postgres_test_url, postgres_schema):
    apply_schema(postgres_test_url)
    apply_schema(postgres_test_url)

    with psycopg.connect(postgres_test_url) as connection:
        database_name, table_count = connection.execute(
            """
            select current_database(), count(*)
            from information_schema.tables
            where table_schema = 'public'
              and table_name in ('users', 'bins', 'recycling_submissions', 'rewards')
            group by current_database()
            """
        ).fetchone()

    assert database_name.endswith("_test")
    assert table_count == 4


def test_seed_and_cleanup_are_confined_to_test_database(
    postgres_test_url, seed_operating_catalog, reset_test_database
):
    with psycopg.connect(postgres_test_url) as connection:
        database_name = connection.execute("select current_database()").fetchone()[0]
        role_counts = dict(
            connection.execute(
                "select role, count(*) from users group by role order by role"
            ).fetchall()
        )
        catalog_counts = connection.execute(
            """
            select
              (select count(*) from bins),
              (select count(*) from waste_types),
              (select count(*) from rewards),
              (select count(*) from missions)
            """
        ).fetchone()

    assert database_name.endswith("_test")
    assert role_counts == {"admin": 1, "student": 2, "volunteer": 3}
    assert catalog_counts == (2, 2, 2, 1)
    assert seed_operating_catalog["student_a"] == SEED_IDS["student_a"]

    reset_test_database()
    with psycopg.connect(postgres_test_url) as connection:
        remaining = connection.execute("select count(*) from users").fetchone()[0]
    assert remaining == 0


def test_api_client_uses_seeded_test_database(seed_operating_catalog, api_client):
    health_response = api_client.get("/api/health/db")
    login_response = api_client.post(
        "/api/auth/login",
        json={"email": "student.a@hyute.edu.vn", "password": "TestPass-2026!"},
    )

    assert health_response.status_code == 200
    assert health_response.json() == {
        "configured": True,
        "status": "ok",
        "database": "ecoloop_campus_test",
        "user": "ecoloop_app",
    }
    assert login_response.status_code == 200
    assert login_response.json()["user"]["id"] == seed_operating_catalog["student_a"]
