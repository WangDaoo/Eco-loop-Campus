from concurrent.futures import ThreadPoolExecutor

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


def create_and_scan_submission(api_client):
    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer_headers = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    create_response = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student_headers,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    )
    assert create_response.status_code == 201
    submission = create_response.json()["data"]
    scan_response = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=volunteer_headers,
        json={"qrToken": submission["qrToken"], "stationId": SEED_IDS["bin_a"]},
    )
    assert scan_response.status_code == 200
    assert scan_response.json()["data"]["result"] == "SUCCESS"
    return submission, volunteer_headers


def submission_state(database_url, submission_id):
    with psycopg.connect(database_url) as connection:
        return connection.execute(
            "select status, verified_by from recycling_submissions where id = %s",
            (submission_id,),
        ).fetchone()


def disable_missions(database_url):
    with psycopg.connect(database_url) as connection:
        connection.execute("update missions set status = 'inactive'")
        connection.commit()


def test_real_submission_flow_is_atomic_idempotent_and_visible_to_both_clients(
    postgres_test_url, seed_operating_catalog, api_client, monkeypatch, tmp_path
):
    import app as backend_app

    monkeypatch.setattr(backend_app, "PROOF_UPLOADS_DIR", tmp_path / "proofs")
    disable_missions(postgres_test_url)
    student = login_headers(api_client, "student.a@hyute.edu.vn")
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
    assert created_response.status_code == 201
    created = created_response.json()["data"]
    assert created["status"] == "CREATED"

    scanned = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=volunteer,
        json={"qrToken": created["qrToken"], "stationId": SEED_IDS["bin_a"]},
    )
    assert scanned.status_code == 200
    assert scanned.json()["data"]["result"] == "SUCCESS"
    proof = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/proof",
        headers=volunteer,
        data={"note": "Ảnh cân thực tế"},
        files={"file": ("proof.jpg", b"real-proof-content", "image/jpeg")},
    )
    assert proof.status_code == 200
    confirmed = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer,
        json={"actualQuantity": 1.5, "note": "Đã đối chiếu"},
    )
    replay = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer,
        json={"actualQuantity": 1.5, "note": "Replay"},
    )

    assert confirmed.status_code == 200
    assert confirmed.json()["data"] == {
        "status": "POINT_CONFIRMED",
        "points": 15,
        "submissionId": created["id"],
    }
    assert replay.status_code == 400
    mobile = api_client.get("/api/mobile/initial-data", headers=student).json()
    admin_rows = api_client.get(
        "/api/admin/recycling-submissions", headers=admin
    ).json()["data"]
    mobile_submission = next(
        row for row in mobile["submissions"] if row["id"] == created["id"]
    )
    admin_submission = next(row for row in admin_rows if row["id"] == created["id"])
    assert mobile_submission == admin_submission
    assert mobile_submission["status"] == "POINT_CONFIRMED"
    assert float(mobile_submission["actualQuantity"]) == 1.5
    assert mobile_submission["verifiedBy"] == SEED_IDS["volunteer_a"]
    matching_history = [
        row
        for row in mobile["pointTransactions"]
        if row.get("submissionId") == created["id"]
    ]
    assert len(matching_history) == 1
    assert matching_history[0]["points"] == 15
    assert matching_history[0]["source"] == "qr_submission"
    assert next(
        row for row in mobile["users"] if row["id"] == SEED_IDS["student_a"]
    )["points"] == 1015


@pytest.mark.parametrize("quantity", [0, -1, None, "not-a-number"])
def test_create_rejects_invalid_quantity_without_partial_write(
    quantity, postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")

    response = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": quantity,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "INVALID_QUANTITY"
    with psycopg.connect(postgres_test_url) as connection:
        assert connection.execute(
            "select count(*) from recycling_submissions"
        ).fetchone()[0] == 0


@pytest.mark.parametrize("catalog", ["station", "waste"])
def test_create_rejects_inactive_catalog_rows_with_stable_error(
    catalog, postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    with psycopg.connect(postgres_test_url) as connection:
        if catalog == "station":
            connection.execute(
                "update bins set status = 'full' where id = %s", (SEED_IDS["bin_a"],)
            )
            expected = "INVALID_STATION"
        else:
            connection.execute(
                "update waste_types set status = 'inactive' where id = %s",
                (SEED_IDS["waste_plastic"],),
            )
            expected = "INVALID_WASTE_TYPE"
        connection.commit()

    response = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == expected


@pytest.mark.parametrize("actual_quantity", [0, -1, None, "not-a-number"])
def test_confirm_rejects_invalid_actual_quantity_without_awarding_points(
    actual_quantity, postgres_test_url, seed_operating_catalog, api_client
):
    disable_missions(postgres_test_url)
    submission, volunteer = create_and_scan_submission(api_client)
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "insert into proof_images (submission_id, image_url) values (%s, '/proof.jpg')",
            (submission["id"],),
        )
        connection.commit()

    response = api_client.post(
        f"/api/mobile/recycling-submissions/{submission['id']}/confirm",
        headers=volunteer,
        json={"actualQuantity": actual_quantity, "note": "Invalid"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "INVALID_QUANTITY"
    with psycopg.connect(postgres_test_url) as connection:
        status = connection.execute(
            "select status from recycling_submissions where id = %s",
            (submission["id"],),
        ).fetchone()[0]
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
        history = connection.execute("select count(*) from point_history").fetchone()[0]
    assert status == "QR_SCANNED"
    assert points == 1000
    assert history == 0


def test_two_concurrent_confirms_award_submission_points_only_once(
    postgres_test_url, seed_operating_catalog, api_client
):
    disable_missions(postgres_test_url)
    submission, _volunteer = create_and_scan_submission(api_client)
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "insert into proof_images (submission_id, image_url) values (%s, '/proof.jpg')",
            (submission["id"],),
        )
        connection.commit()

    def confirm(note):
        try:
            with psycopg.connect(postgres_test_url) as connection:
                result = connection.execute(
                    "select confirm_recycling_submission(%s, %s, %s, %s)",
                    (submission["id"], SEED_IDS["volunteer_a"], 1, note),
                ).fetchone()[0]
                connection.commit()
                return result["status"]
        except Exception as error:
            return str(error).strip().splitlines()[0]

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(confirm, ["first", "second"]))

    assert sorted(results) == ["INVALID_SUBMISSION_STATUS", "POINT_CONFIRMED"]
    with psycopg.connect(postgres_test_url) as connection:
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
        history = connection.execute(
            "select count(*) from point_history where submission_id = %s",
            (submission["id"],),
        ).fetchone()[0]
    assert points == 1010
    assert history == 1


@pytest.mark.parametrize(
    ("mode", "expected_result", "expected_status"),
    [
        ("invalid", "INVALID_TOKEN", None),
        ("wrong-station", "WRONG_STATION", "CREATED"),
        ("expired", "EXPIRED", "EXPIRED"),
        ("replay", "ALREADY_USED", "QR_SCANNED"),
    ],
)
def test_scan_outcomes_are_persisted_without_invalid_state_transition(
    mode,
    expected_result,
    expected_status,
    postgres_test_url,
    seed_operating_catalog,
    api_client,
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    if mode == "invalid":
        submission = None
        token = "ECL-SUB-NOT-FOUND"
        station_id = SEED_IDS["bin_a"]
    else:
        created = api_client.post(
            "/api/mobile/recycling-submissions",
            headers=student,
            json={
                "binId": SEED_IDS["bin_a"],
                "wasteTypeId": SEED_IDS["waste_plastic"],
                "quantity": 1,
            },
        ).json()["data"]
        submission = created
        token = created["qrToken"]
        station_id = (
            SEED_IDS["bin_b"] if mode == "wrong-station" else SEED_IDS["bin_a"]
        )
        if mode == "expired":
            with psycopg.connect(postgres_test_url) as connection:
                connection.execute(
                    "update recycling_submissions set expired_at = now() - interval '1 minute' where id = %s",
                    (created["id"],),
                )
                connection.commit()
        elif mode == "replay":
            first = api_client.post(
                "/api/mobile/recycling-submissions/scan",
                headers=volunteer,
                json={"qrToken": token, "stationId": station_id},
            )
            assert first.json()["data"]["result"] == "SUCCESS"

    response = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=volunteer,
        json={"qrToken": token, "stationId": station_id},
    )

    assert response.status_code == 200
    assert response.json()["data"]["result"] == expected_result
    with psycopg.connect(postgres_test_url) as connection:
        log = connection.execute(
            "select result from qr_scan_logs order by scanned_at desc limit 1"
        ).fetchone()[0]
        status = (
            connection.execute(
                "select status from recycling_submissions where id = %s",
                (submission["id"],),
            ).fetchone()[0]
            if submission
            else None
        )
    assert log == expected_result
    assert status == expected_status


def test_only_scanning_volunteer_can_upload_submission_proof(
    postgres_test_url, seed_operating_catalog, api_client, monkeypatch, tmp_path
):
    import app as backend_app

    monkeypatch.setattr(backend_app, "PROOF_UPLOADS_DIR", tmp_path / "proofs")
    submission, owner_headers = create_and_scan_submission(api_client)
    other_headers = login_headers(api_client, "volunteer.b@hyute.edu.vn")

    rejected_response = api_client.post(
        f"/api/mobile/recycling-submissions/{submission['id']}/proof",
        headers=other_headers,
        files={"file": ("proof.png", b"private-proof", "image/png")},
    )
    accepted_response = api_client.post(
        f"/api/mobile/recycling-submissions/{submission['id']}/proof",
        headers=owner_headers,
        files={"file": ("proof.png", b"owner-proof", "image/png")},
    )

    assert rejected_response.status_code == 403
    assert accepted_response.status_code == 200
    with psycopg.connect(postgres_test_url) as connection:
        proof_count = connection.execute(
            "select count(*) from proof_images where submission_id = %s",
            (submission["id"],),
        ).fetchone()[0]
    assert proof_count == 1


@pytest.mark.parametrize(
    ("action", "payload"),
    (
        ("confirm", {"actualQuantity": 1, "note": "Other volunteer"}),
        ("reject", {"note": "Other volunteer"}),
        ("review", {"note": "Other volunteer"}),
    ),
)
def test_other_volunteer_cannot_transition_scanned_submission(
    action,
    payload,
    postgres_test_url,
    seed_operating_catalog,
    api_client,
):
    submission, _owner_headers = create_and_scan_submission(api_client)
    other_headers = login_headers(api_client, "volunteer.b@hyute.edu.vn")
    if action == "confirm":
        with psycopg.connect(postgres_test_url) as connection:
            connection.execute(
                """
                insert into proof_images (submission_id, image_url, status)
                values (%s, '/test-proof.jpg', 'pending')
                """,
                (submission["id"],),
            )
            connection.commit()

    response = api_client.post(
        f"/api/mobile/recycling-submissions/{submission['id']}/{action}",
        headers=other_headers,
        json=payload,
    )

    assert response.status_code == 403
    assert submission_state(postgres_test_url, submission["id"]) == (
        "QR_SCANNED",
        SEED_IDS["volunteer_a"],
    )
