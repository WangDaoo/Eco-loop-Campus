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
