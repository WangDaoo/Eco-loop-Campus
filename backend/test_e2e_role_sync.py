import psycopg
import pytest

from test_support.postgres import SEED_IDS


pytestmark = pytest.mark.postgres
TEST_PASSWORD = "TestPass-2026!"


def login_headers(api_client, email):
    response = api_client.post(
        "/api/auth/login", json={"email": email, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def create_reward_batch(api_client, student_headers):
    response = api_client.post(
        "/api/mobile/reward-redemptions",
        headers=student_headers,
        json={
            "items": [
                {"rewardId": SEED_IDS["reward_voucher"], "quantity": 2},
                {"rewardId": SEED_IDS["reward_bottle"], "quantity": 1},
            ]
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def test_scenario_a_registered_student_submission_is_synced_exactly_once(
    postgres_test_url, seed_operating_catalog, api_client, monkeypatch, tmp_path
):
    import app as backend_app

    monkeypatch.setattr(backend_app, "PROOF_UPLOADS_DIR", tmp_path / "proofs")
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute("update missions set status = 'inactive'")
        connection.commit()
    registration = api_client.post(
        "/api/auth/register",
        json={
            "name": "Sinh viên E2E",
            "email": "student.e2e@hyute.edu.vn",
            "password": TEST_PASSWORD,
            "role": "student",
            "studentCode": "E2E20260001",
            "facultyCode": "information-technology",
            "phoneNumber": "0911222333",
        },
    )
    assert registration.status_code == 201, registration.text
    registered = registration.json()["user"]
    assert registered["facultyName"] == "Khoa Công nghệ thông tin"
    student = {"Authorization": f"Bearer {registration.json()['token']}"}
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    admin = login_headers(api_client, "admin.test@hyute.edu.vn")

    created_response = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 2,
        },
    )
    assert created_response.status_code == 201, created_response.text
    created = created_response.json()["data"]
    scan = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=volunteer,
        json={"qrToken": created["qrToken"], "stationId": SEED_IDS["bin_a"]},
    )
    assert scan.status_code == 200
    assert scan.json()["data"]["result"] == "SUCCESS"
    proof = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/proof",
        headers=volunteer,
        data={"note": "Ảnh cân E2E"},
        files={"file": ("proof-e2e.jpg", b"e2e-proof", "image/jpeg")},
    )
    assert proof.status_code == 200, proof.text
    confirmed = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer,
        json={"actualQuantity": 1.5, "note": "Xác nhận E2E"},
    )
    replay = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer,
        json={"actualQuantity": 1.5, "note": "Không được cộng lại"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["data"]["points"] == 15
    assert replay.status_code == 400

    mobile = api_client.get("/api/mobile/initial-data", headers=student).json()
    mobile_profile = api_client.get("/api/auth/me", headers=student).json()["user"]
    admin_submissions = api_client.get(
        "/api/admin/recycling-submissions", headers=admin
    ).json()["data"]
    admin_users = api_client.get("/api/admin/users", headers=admin).json()["data"]
    admin_history = api_client.get(
        "/api/admin/point-history", headers=admin
    ).json()["data"]
    mobile_submission = next(
        row for row in mobile["submissions"] if row["id"] == created["id"]
    )
    admin_submission = next(
        row for row in admin_submissions if row["id"] == created["id"]
    )
    mobile_history = [
        row
        for row in mobile["pointTransactions"]
        if row.get("submissionId") == created["id"]
    ]
    matching_admin_history = [
        row for row in admin_history if row.get("submissionId") == created["id"]
    ]
    mobile_user = next(row for row in mobile["users"] if row["id"] == registered["id"])
    admin_user = next(row for row in admin_users if row["id"] == registered["id"])

    assert mobile_submission == admin_submission
    assert mobile_submission["status"] == "POINT_CONFIRMED"
    assert len(mobile_history) == len(matching_admin_history) == 1
    assert mobile_history[0]["points"] == matching_admin_history[0]["points"] == 15
    assert mobile_user["points"] == mobile_profile["points"] == admin_user["points"] == 15
    assert mobile_profile["studentCode"] == admin_user["studentCode"] == "E2E20260001"
    assert mobile_profile["facultyCode"] == admin_user["facultyCode"] == "information-technology"
    assert mobile_profile["phoneNumber"] == admin_user["phoneNumber"] == "0911222333"


def test_scenario_b_reward_handover_and_admin_reversal_stay_in_sync(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    admin = login_headers(api_client, "admin.test@hyute.edu.vn")
    batch = create_reward_batch(api_client, student)

    handover = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )
    assert handover.status_code == 200, handover.text
    assert handover.json()["data"]["status"] == "fulfilled"

    mobile_after_handover = api_client.get(
        "/api/mobile/initial-data", headers=student
    ).json()
    admin_after_handover = api_client.get(
        "/api/admin/reward-redemption-batches", headers=admin
    ).json()["data"]
    mobile_batch = next(
        row for row in mobile_after_handover["rewardRedemptions"] if row["id"] == batch["id"]
    )
    admin_batch = next(row for row in admin_after_handover if row["id"] == batch["id"])
    student_row = next(
        row for row in mobile_after_handover["users"] if row["id"] == SEED_IDS["student_a"]
    )
    assert mobile_batch["status"] == admin_batch["status"] == "fulfilled"
    assert mobile_batch["items"] == admin_batch["items"]
    assert mobile_batch["totalPoints"] == 450
    assert student_row["points"] == 550

    cancelled = api_client.post(
        f"/api/admin/reward-redemption-batches/{batch['id']}/finalize",
        headers=admin,
        json={"status": "cancelled", "note": "Hoàn tác E2E"},
    )
    replay = api_client.post(
        f"/api/admin/reward-redemption-batches/{batch['id']}/finalize",
        headers=admin,
        json={"status": "cancelled", "note": "Không hoàn lần hai"},
    )
    assert cancelled.status_code == 200
    assert replay.status_code == 400

    mobile_after_reversal = api_client.get(
        "/api/mobile/initial-data", headers=student
    ).json()
    admin_batches = api_client.get(
        "/api/admin/reward-redemption-batches", headers=admin
    ).json()["data"]
    admin_rewards = api_client.get("/api/admin/rewards", headers=admin).json()["data"]
    mobile_reversed = next(
        row for row in mobile_after_reversal["rewardRedemptions"] if row["id"] == batch["id"]
    )
    admin_reversed = next(row for row in admin_batches if row["id"] == batch["id"])
    student_row = next(
        row for row in mobile_after_reversal["users"] if row["id"] == SEED_IDS["student_a"]
    )
    stocks = {row["id"]: row["stock"] for row in admin_rewards}
    batch_history = [
        row
        for row in mobile_after_reversal["pointTransactions"]
        if row.get("referenceId") == batch["id"]
    ]
    assert mobile_reversed["status"] == admin_reversed["status"] == "cancelled"
    assert student_row["points"] == 1000
    assert stocks[SEED_IDS["reward_voucher"]] == 3
    assert stocks[SEED_IDS["reward_bottle"]] == 2
    assert sorted((row["source"], row["points"]) for row in batch_history) == sorted(
        [("reward_redemption", -450), ("reward_refund", 450)]
    )


def test_scenario_c_ineligible_and_non_owner_actions_leave_database_unchanged(
    postgres_test_url, seed_operating_catalog, api_client, monkeypatch, tmp_path
):
    import app as backend_app

    monkeypatch.setattr(backend_app, "PROOF_UPLOADS_DIR", tmp_path / "proofs")
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    owner = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    other = login_headers(api_client, "volunteer.b@hyute.edu.vn")
    admin = login_headers(api_client, "admin.test@hyute.edu.vn")
    pending_login = api_client.post(
        "/api/auth/login",
        json={"email": "volunteer.pending@hyute.edu.vn", "password": TEST_PASSWORD},
    )
    assert pending_login.status_code == 403

    created = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    ).json()["data"]
    scan = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=owner,
        json={"qrToken": created["qrToken"], "stationId": SEED_IDS["bin_a"]},
    )
    assert scan.status_code == 200
    other_proof = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/proof",
        headers=other,
        files={"file": ("not-owner.jpg", b"not-owner", "image/jpeg")},
    )
    other_confirm = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=other,
        json={"actualQuantity": 1, "note": "Không phải owner"},
    )
    assert other_proof.status_code == other_confirm.status_code == 403

    batch = create_reward_batch(api_client, student)
    locked = api_client.patch(
        f"/api/users/{SEED_IDS['volunteer_b']}/status",
        headers=admin,
        json={"status": "locked"},
    )
    assert locked.status_code == 200, locked.text
    locked_scan = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=other,
        json={"qrToken": batch["qrToken"]},
    )
    assert locked_scan.status_code == 403

    with psycopg.connect(postgres_test_url) as connection:
        submission_state = connection.execute(
            "select status, verified_by from recycling_submissions where id = %s",
            (created["id"],),
        ).fetchone()
        proof_count = connection.execute(
            "select count(*) from proof_images where submission_id = %s", (created["id"],)
        ).fetchone()[0]
        batch_state = connection.execute(
            "select status, scanned_by from reward_redemption_batches where id = %s",
            (batch["id"],),
        ).fetchone()
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
        stocks = dict(
            connection.execute(
                "select id, stock from rewards where id in (%s, %s)",
                (SEED_IDS["reward_voucher"], SEED_IDS["reward_bottle"]),
            ).fetchall()
        )
        history_count = connection.execute("select count(*) from point_history").fetchone()[0]

    assert submission_state == ("QR_SCANNED", SEED_IDS["volunteer_a"])
    assert proof_count == 0
    assert batch_state == ("pending", None)
    assert points == 1000
    assert stocks == {
        SEED_IDS["reward_voucher"]: 3,
        SEED_IDS["reward_bottle"]: 2,
    }
    assert history_count == 0
