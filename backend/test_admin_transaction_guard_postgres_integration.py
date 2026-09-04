import psycopg
import pytest

from test_support.postgres import SEED_IDS


pytestmark = pytest.mark.postgres
TEST_PASSWORD = "TestPass-2026!"


def login_headers(api_client, email):
    response = api_client.post(
        "/api/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def test_admin_generic_resources_cannot_bypass_point_or_submission_transactions(
    postgres_test_url, seed_operating_catalog, api_client
):
    admin_headers = login_headers(api_client, "admin.test@hyute.edu.vn")
    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")
    create_response = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student_headers,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    )
    submission = create_response.json()["data"]

    status_response = api_client.post(
        "/api/admin/recycling-submissions",
        headers=admin_headers,
        json={
            "id": submission["id"],
            "userId": SEED_IDS["student_a"],
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
            "unit": "item",
            "qrToken": submission["qrToken"],
            "status": "POINT_CONFIRMED",
            "expiredAt": submission["expiredAt"],
            "actualQuantity": 99,
        },
    )
    history_response = api_client.post(
        "/api/admin/point-history",
        headers=admin_headers,
        json={
            "userId": SEED_IDS["student_a"],
            "class": "manual-bypass",
            "binGroup": "Điều chỉnh",
            "action": "Bypass",
            "points": 999,
            "source": "manual_adjustment",
            "description": "Must be rejected",
            "status": "confirmed",
        },
    )
    user_response = api_client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "name": "Bypass User",
            "email": "bypass@hyute.edu.vn",
            "role": "student",
            "group": "Khoa Công nghệ thông tin",
            "points": 999,
            "status": "locked",
        },
    )

    assert status_response.status_code == 405
    assert history_response.status_code == 405
    assert user_response.status_code == 400
    with psycopg.connect(postgres_test_url) as connection:
        status, actual_quantity = connection.execute(
            "select status, actual_quantity from recycling_submissions where id = %s",
            (submission["id"],),
        ).fetchone()
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
        history_count = connection.execute(
            "select count(*) from point_history"
        ).fetchone()[0]
        bypass_user_count = connection.execute(
            "select count(*) from users where email = 'bypass@hyute.edu.vn'"
        ).fetchone()[0]

    assert (status, actual_quantity) == ("CREATED", None)
    assert points == 1000
    assert history_count == 0
    assert bypass_user_count == 0
