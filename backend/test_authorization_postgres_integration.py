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


def token_headers(user_id, role):
    import app as backend_app

    token = backend_app.create_auth_token({"sub": user_id, "role": role})
    return {"Authorization": f"Bearer {token}"}


def seed_private_mobile_rows(database_url):
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                insert into recycling_submissions
                  (id, user_id, bin_id, waste_type_id, quantity, unit, qr_token,
                   status, expired_at, verified_by, verified_at, actual_quantity)
                values
                  (%s, %s, %s, %s, 1, 'item', %s, 'QR_SCANNED',
                   now() + interval '30 minutes', %s, now(), 1)
                """,
                (
                    (
                        "PRIVATE-SUB-A",
                        SEED_IDS["student_a"],
                        SEED_IDS["bin_a"],
                        SEED_IDS["waste_plastic"],
                        "PRIVATE-QR-A",
                        SEED_IDS["volunteer_a"],
                    ),
                    (
                        "PRIVATE-SUB-B",
                        SEED_IDS["student_b"],
                        SEED_IDS["bin_b"],
                        SEED_IDS["waste_paper"],
                        "PRIVATE-QR-B",
                        SEED_IDS["volunteer_b"],
                    ),
                ),
            )
            cursor.executemany(
                """
                insert into predictions
                  (id, class, confidence, source, bin_group, status, user_id, bin_id)
                values (%s, %s, 0.9, 'mobile', 'Tái chế', 'approved', %s, %s)
                """,
                (
                    ("PRIVATE-PRED-A", "plastic", SEED_IDS["student_a"], SEED_IDS["bin_a"]),
                    ("PRIVATE-PRED-B", "paper", SEED_IDS["student_b"], SEED_IDS["bin_b"]),
                ),
            )
            cursor.executemany(
                """
                insert into point_history
                  (submission_id, user_id, bin_id, class, bin_group, action,
                   points, source, description, reference_type, reference_id)
                values (%s, %s, %s, 'recycling', 'Tái chế', 'Private test',
                        10, 'qr_submission', 'Private integration row',
                        'submission', %s)
                """,
                (
                    ("PRIVATE-SUB-A", SEED_IDS["student_a"], SEED_IDS["bin_a"], "PRIVATE-SUB-A"),
                    ("PRIVATE-SUB-B", SEED_IDS["student_b"], SEED_IDS["bin_b"], "PRIVATE-SUB-B"),
                ),
            )
            cursor.executemany(
                """
                insert into feedback
                  (id, user_id, user_name, category, message, bin_id)
                values (%s, %s, %s, 'other', %s, %s)
                """,
                (
                    ("PRIVATE-FEEDBACK-A", SEED_IDS["student_a"], "Student A", "Private A", SEED_IDS["bin_a"]),
                    ("PRIVATE-FEEDBACK-B", SEED_IDS["student_b"], "Student B", "Private B", SEED_IDS["bin_b"]),
                ),
            )
            cursor.executemany(
                """
                insert into reward_redemptions
                  (id, user_id, reward_id, reward_label, cost_points, status)
                values (%s, %s, %s, 'Private reward', 100, 'pending')
                """,
                (
                    ("PRIVATE-REWARD-A", SEED_IDS["student_a"], SEED_IDS["reward_voucher"]),
                    ("PRIVATE-REWARD-B", SEED_IDS["student_b"], SEED_IDS["reward_bottle"]),
                ),
            )
            cursor.executemany(
                """
                insert into proof_images
                  (id, submission_id, image_url, image_hash, verification_code)
                values (%s, %s, %s, %s, %s)
                """,
                (
                    ("PRIVATE-PROOF-A", "PRIVATE-SUB-A", "/proof-a.jpg", "hash-a", "code-a"),
                    ("PRIVATE-PROOF-B", "PRIVATE-SUB-B", "/proof-b.jpg", "hash-b", "code-b"),
                ),
            )
            cursor.executemany(
                """
                insert into qr_scan_logs
                  (id, qr_token, scanned_by, station_id, result, note)
                values (%s, %s, %s, %s, 'SUCCESS', %s)
                """,
                (
                    ("PRIVATE-LOG-A", "PRIVATE-QR-A", SEED_IDS["volunteer_a"], SEED_IDS["bin_a"], "Private A"),
                    ("PRIVATE-LOG-B", "PRIVATE-QR-B", SEED_IDS["volunteer_b"], SEED_IDS["bin_b"], "Private B"),
                ),
            )
        connection.commit()


def ids(rows, key="id"):
    return {row[key] for row in rows}


def test_token_is_rejected_immediately_after_account_is_locked(
    postgres_test_url, seed_operating_catalog, api_client
):
    headers = login_headers(api_client, "student.a@hyute.edu.vn")
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update users set status = 'locked' where id = %s",
            (SEED_IDS["student_a"],),
        )
        connection.commit()

    me_response = api_client.get("/api/auth/me", headers=headers)
    initial_data_response = api_client.get("/api/mobile/initial-data", headers=headers)

    assert me_response.status_code == 403
    assert initial_data_response.status_code == 403
    assert "không hoạt động" in initial_data_response.json()["detail"].lower()


def test_student_initial_data_contains_only_owned_private_rows(
    postgres_test_url, seed_operating_catalog, api_client
):
    seed_private_mobile_rows(postgres_test_url)
    headers = login_headers(api_client, "student.a@hyute.edu.vn")

    response = api_client.get("/api/mobile/initial-data", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert ids(payload["predictions"]) == {"PRIVATE-PRED-A"}
    assert ids(payload["submissions"]) == {"PRIVATE-SUB-A"}
    assert ids(payload["pointTransactions"], "reference_id") == {"PRIVATE-SUB-A"}
    assert ids(payload["feedbacks"]) == {"PRIVATE-FEEDBACK-A"}
    assert ids(payload["rewardRedemptions"]) == {"PRIVATE-REWARD-A"}
    assert ids(payload["proofImages"]) == {"PRIVATE-PROOF-A"}
    assert payload["qrScanLogs"] == []

    assert ids(payload["users"]) == {SEED_IDS["student_a"], SEED_IDS["student_b"]}
    allowed_leaderboard_fields = {
        "id", "name", "group", "points", "avatarKey", "avatarUrl"
    }
    assert all(set(user) <= allowed_leaderboard_fields for user in payload["users"])
    assert all("email" not in user and "phoneNumber" not in user for user in payload["users"])


def test_volunteer_initial_data_contains_only_assigned_workload_and_own_logs(
    postgres_test_url, seed_operating_catalog, api_client
):
    seed_private_mobile_rows(postgres_test_url)
    headers = login_headers(api_client, "volunteer.a@hyute.edu.vn")

    response = api_client.get("/api/mobile/initial-data", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert ids(payload["submissions"]) == {"PRIVATE-SUB-A"}
    assert ids(payload["proofImages"]) == {"PRIVATE-PROOF-A"}
    assert ids(payload["qrScanLogs"]) == {"PRIVATE-LOG-A"}
    assert payload["predictions"] == []
    assert payload["pointTransactions"] == []
    assert payload["feedbacks"] == []
    assert payload["rewardRedemptions"] == []
    assert all("email" not in user and "phoneNumber" not in user for user in payload["users"])


def test_mobile_initial_data_authorization_matrix(
    postgres_test_url, seed_operating_catalog, api_client
):
    cases = (
        ({}, 401),
        ({"Authorization": "Bearer broken-token"}, 401),
        (token_headers(SEED_IDS["student_a"], "student"), 200),
        (token_headers(SEED_IDS["volunteer_a"], "volunteer"), 200),
        (token_headers(SEED_IDS["admin"], "admin"), 200),
        (token_headers(SEED_IDS["volunteer_pending"], "volunteer"), 403),
    )
    for headers, expected_status in cases:
        response = api_client.get("/api/mobile/initial-data", headers=headers)
        assert response.status_code == expected_status

    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update users set status = 'locked' where id = %s",
            (SEED_IDS["student_b"],),
        )
        connection.execute(
            "update users set status = 'rejected' where id = %s",
            (SEED_IDS["volunteer_b"],),
        )
        connection.commit()

    assert api_client.get(
        "/api/mobile/initial-data",
        headers=token_headers(SEED_IDS["student_b"], "student"),
    ).status_code == 403
    assert api_client.get(
        "/api/mobile/initial-data",
        headers=token_headers(SEED_IDS["volunteer_b"], "volunteer"),
    ).status_code == 403


def test_admin_resource_is_restricted_to_active_admin(
    seed_operating_catalog, api_client
):
    cases = (
        ({}, 401),
        ({"Authorization": "Bearer broken-token"}, 401),
        (token_headers(SEED_IDS["student_a"], "student"), 403),
        (token_headers(SEED_IDS["volunteer_a"], "volunteer"), 403),
        (token_headers(SEED_IDS["volunteer_pending"], "volunteer"), 403),
        (token_headers(SEED_IDS["admin"], "admin"), 200),
    )
    for headers, expected_status in cases:
        response = api_client.get("/api/admin/users", headers=headers)
        assert response.status_code == expected_status

    admin_payload = api_client.get(
        "/api/admin/users", headers=token_headers(SEED_IDS["admin"], "admin")
    ).json()["data"]
    assert any(user["email"] == "student.a@hyute.edu.vn" for user in admin_payload)
