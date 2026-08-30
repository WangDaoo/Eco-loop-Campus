import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app


@pytest.fixture()
def client():
    with TestClient(app.app) as test_client:
        yield test_client


def bearer(role="student", subject=None):
    user_id = subject or f"{role}-1"
    return {"Authorization": f"Bearer {app.create_auth_token({'sub': user_id, 'role': role})}"}


def patch_current_user(monkeypatch, role="student"):
    monkeypatch.setattr(
        app,
        "get_user_account",
        lambda user_id: {
            "id": user_id,
            "name": role.title(),
            "email": f"{role}@school.edu.vn",
            "role": role,
            "status": "active",
            "points": 0,
        },
        raising=False,
    )


def test_student_creates_recycling_submission_qr(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    captured = {}

    def fake_create(user_id, payload):
        captured["user_id"] = user_id
        captured["payload"] = payload
        return {"id": "sub-1", "qrToken": "ECL-SUB-1", "status": "CREATED"}

    monkeypatch.setattr(app, "create_recycling_submission_account", fake_create, raising=False)

    response = client.post(
        "/api/mobile/recycling-submissions",
        json={"binId": "bin-e1", "wasteTypeId": "paper", "quantity": 1},
        headers=bearer("student"),
    )

    assert response.status_code == 201
    assert response.json()["data"]["qrToken"] == "ECL-SUB-1"
    assert captured["user_id"] == "student-1"
    assert captured["payload"]["binId"] == "bin-e1"


def test_volunteer_scans_recycling_qr(client, monkeypatch):
    patch_current_user(monkeypatch, "volunteer")
    monkeypatch.setattr(
        app,
        "scan_recycling_submission_account",
        lambda volunteer_id, payload: {"result": "SUCCESS", "submissionId": "sub-1"},
        raising=False,
    )

    response = client.post(
        "/api/mobile/recycling-submissions/scan",
        json={"qrToken": "ECL-SUB-1", "stationId": "bin-e1"},
        headers=bearer("volunteer"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["result"] == "SUCCESS"


def test_student_cannot_scan_recycling_qr(client, monkeypatch):
    patch_current_user(monkeypatch, "student")

    response = client.post(
        "/api/mobile/recycling-submissions/scan",
        json={"qrToken": "ECL-SUB-1", "stationId": "bin-e1"},
        headers=bearer("student"),
    )

    assert response.status_code == 403


def test_volunteer_uploads_proof_image(client, monkeypatch):
    patch_current_user(monkeypatch, "volunteer")
    monkeypatch.setattr(
        app,
        "save_submission_proof_image",
        lambda submission_id, file_name, content_type, content, note: {
            "id": "proof-1",
            "submissionId": submission_id,
            "imageUrl": "/uploads/proofs/sub-1/proof.png",
            "status": "pending",
        },
        raising=False,
    )

    response = client.post(
        "/api/mobile/recycling-submissions/sub-1/proof",
        data={"note": "E2E_proof"},
        files={"file": ("proof.png", b"png-bytes", "image/png")},
        headers=bearer("volunteer"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["submissionId"] == "sub-1"


def test_volunteer_confirms_recycling_submission(client, monkeypatch):
    patch_current_user(monkeypatch, "volunteer")
    monkeypatch.setattr(
        app,
        "confirm_recycling_submission_account",
        lambda volunteer_id, submission_id, payload: {"status": "POINT_CONFIRMED", "points": 5},
        raising=False,
    )

    response = client.post(
        "/api/mobile/recycling-submissions/sub-1/confirm",
        json={"actualQuantity": 1, "note": "OK"},
        headers=bearer("volunteer"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["points"] == 5


def test_postgres_business_error_maps_to_client_error(monkeypatch):
    if app.psycopg is None:
        pytest.skip("psycopg is not installed")

    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def execute(self, query, args):
            raise app.psycopg.errors.RaiseException("PROOF_IMAGE_REQUIRED")

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def cursor(self):
            return FakeCursor()

        def commit(self):
            pass

    monkeypatch.setattr(app, "require_database_url", lambda: "postgresql://example", raising=False)
    monkeypatch.setattr(app.psycopg, "connect", lambda database_url: FakeConnection(), raising=False)

    with pytest.raises(HTTPException) as error:
        app.call_postgres_json_function("confirm_recycling_submission", ["sub-1", "volunteer-1", 1, ""])

    assert error.value.status_code == 400
    assert error.value.detail == "PROOF_IMAGE_REQUIRED"

def test_volunteer_rejects_and_requests_review(client, monkeypatch):
    patch_current_user(monkeypatch, "volunteer")
    monkeypatch.setattr(
        app,
        "reject_recycling_submission_account",
        lambda volunteer_id, submission_id, payload: {"status": "REJECTED"},
        raising=False,
    )
    monkeypatch.setattr(
        app,
        "review_recycling_submission_account",
        lambda volunteer_id, submission_id, payload: {"status": "PENDING_REVIEW"},
        raising=False,
    )

    reject = client.post(
        "/api/mobile/recycling-submissions/sub-1/reject",
        json={"note": "Sai ảnh"},
        headers=bearer("volunteer"),
    )
    review = client.post(
        "/api/mobile/recycling-submissions/sub-2/review",
        json={"note": "Cần admin kiểm tra"},
        headers=bearer("volunteer"),
    )

    assert reject.status_code == 200
    assert reject.json()["data"]["status"] == "REJECTED"
    assert review.status_code == 200
    assert review.json()["data"]["status"] == "PENDING_REVIEW"
