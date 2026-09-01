import pytest
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


def test_mobile_initial_data_requires_auth(client):
    response = client.get("/api/mobile/initial-data")

    assert response.status_code == 401


def test_mobile_initial_data_returns_backend_lists(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    monkeypatch.setattr(
        app,
        "load_mobile_initial_data",
        lambda user: {
            "users": [{"id": "student-1"}],
            "stations": [{"id": "bin-e1"}],
            "wasteTypes": [{"id": "paper"}],
            "predictions": [],
            "submissions": [],
            "pointTransactions": [],
            "feedbacks": [],
            "missions": [],
            "rewards": [],
            "rewardRedemptions": [],
            "proofImages": [],
            "qrScanLogs": [],
            "avatarOptions": [{"key": "avatar-1", "label": "Avatar 1", "imageUrl": "/uploads/avatars/avatar-1/a.png"}],
        },
        raising=False,
    )

    response = client.get("/api/mobile/initial-data", headers=bearer("student"))

    assert response.status_code == 200
    assert response.json()["stations"][0]["id"] == "bin-e1"
    assert response.json()["avatarOptions"][0]["key"] == "avatar-1"


def test_mobile_updates_current_user_avatar(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    captured = {}

    def fake_update(user_id, avatar_key):
        captured["user_id"] = user_id
        captured["avatar_key"] = avatar_key
        return {"id": user_id, "avatarKey": avatar_key, "avatarUrl": "/uploads/avatars/a/a.png"}

    monkeypatch.setattr(app, "update_mobile_user_avatar", fake_update, raising=False)

    response = client.patch("/api/mobile/users/me/avatar", json={"avatarKey": "avatar-1"}, headers=bearer("student"))

    assert response.status_code == 200
    assert response.json()["user"]["avatarKey"] == "avatar-1"
    assert captured == {"user_id": "student-1", "avatar_key": "avatar-1"}


def test_mobile_saves_prediction_for_current_user(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    monkeypatch.setattr(
        app,
        "save_mobile_prediction",
        lambda user, payload: {"id": "pred-1", "userId": user["id"], "class": "plastic", "confidence": 0.91},
        raising=False,
    )

    response = client.post(
        "/api/mobile/predictions",
        json={"className": "plastic", "confidence": 0.91, "source": "camera", "binId": "bin-e1"},
        headers=bearer("student"),
    )

    assert response.status_code == 201
    assert response.json()["data"]["userId"] == "student-1"


def test_mobile_submits_feedback_for_current_user(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    monkeypatch.setattr(
        app,
        "save_mobile_feedback",
        lambda user, payload: {"id": "fb-1", "userId": user["id"], "category": payload["type"], "message": payload["message"]},
        raising=False,
    )

    response = client.post(
        "/api/mobile/feedback",
        json={"stationId": "bin-e1", "type": "bin_full", "message": "E2E_feedback"},
        headers=bearer("student"),
    )

    assert response.status_code == 201
    assert response.json()["data"]["category"] == "bin_full"


def test_mobile_advances_mission_for_current_user(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    monkeypatch.setattr(
        app,
        "advance_mobile_mission",
        lambda user_id, mission_id: {"id": mission_id, "current": 1, "completed": False},
        raising=False,
    )

    response = client.post("/api/mobile/missions/mission-1/advance", json={}, headers=bearer("student"))

    assert response.status_code == 200
    assert response.json()["data"]["id"] == "mission-1"


def test_mobile_requests_reward_for_current_user(client, monkeypatch):
    patch_current_user(monkeypatch, "student")
    monkeypatch.setattr(
        app,
        "create_reward_redemption_batch_account",
        lambda user_id, payload: {"id": "batch-1", "studentId": user_id, "qrToken": "ECL-REWARD-1", "status": "pending", "totalPoints": 20},
        raising=False,
    )

    response = client.post("/api/mobile/reward-redemptions", json={"rewardId": "reward-1"}, headers=bearer("student"))

    assert response.status_code == 201
    assert response.json()["data"]["qrToken"] == "ECL-REWARD-1"


def test_admin_uploads_prediction_image(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    monkeypatch.setattr(
        app,
        "save_prediction_upload",
        lambda file_name, content_type, content: {
            "imageName": file_name,
            "imageUrl": "/uploads/predictions/e2e.png",
            "thumbnailUrl": "",
        },
        raising=False,
    )

    response = client.post(
        "/api/uploads/predictions",
        files={"file": ("e2e.png", b"image-bytes", "image/png")},
        headers=bearer("admin"),
    )

    assert response.status_code == 201
    assert response.json()["data"]["imageUrl"] == "/uploads/predictions/e2e.png"
