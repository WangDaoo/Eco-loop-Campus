import pytest
from fastapi.testclient import TestClient

import app


@pytest.fixture()
def client():
    with TestClient(app.app) as test_client:
        yield test_client


def test_auth_password_hash_roundtrip():
    password_hash = app.hash_password("123456")

    assert password_hash != "123456"
    assert app.verify_password("123456", password_hash)
    assert not app.verify_password("wrong", password_hash)


def test_auth_token_roundtrip_and_tamper_rejection():
    token = app.create_auth_token({"sub": "student-1", "role": "student"})

    assert app.verify_auth_token(token)["sub"] == "student-1"
    assert app.verify_auth_token(f"{token}tampered") is None


def test_register_student_creates_active_account(client, monkeypatch):
    def fake_register_user_account(payload):
        assert payload["email"] == "student@school.edu.vn"
        assert payload["password"] == "123456"
        assert payload["role"] == "student"
        return {
            "id": "student-1",
            "name": "Sinh viên E2E",
            "email": "student@school.edu.vn",
            "role": "student",
            "status": "active",
            "points": 0,
        }

    monkeypatch.setattr(app, "register_user_account", fake_register_user_account, raising=False)

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Sinh viên E2E",
            "email": "student@school.edu.vn",
            "password": "123456",
            "role": "student",
        },
    )

    assert response.status_code == 201
    assert response.json()["user"]["status"] == "active"
    assert "passwordHash" not in response.text


def test_register_volunteer_creates_pending_account(client, monkeypatch):
    monkeypatch.setattr(
        app,
        "register_user_account",
        lambda payload: {
            "id": "volunteer-1",
            "name": "Tình nguyện viên E2E",
            "email": payload["email"],
            "role": "volunteer",
            "status": "pending",
            "points": 0,
        },
        raising=False,
    )

    response = client.post(
        "/api/auth/register",
        json={
            "name": "Tình nguyện viên E2E",
            "email": "volunteer@school.edu.vn",
            "password": "123456",
            "role": "volunteer",
        },
    )

    assert response.status_code == 201
    assert response.json()["user"]["status"] == "pending"


def test_login_blocks_pending_volunteer(client, monkeypatch):
    monkeypatch.setattr(
        app,
        "login_user_account",
        lambda email, password: (_ for _ in ()).throw(app.AuthError(403, "Tài khoản tình nguyện viên đang chờ duyệt")),
        raising=False,
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "volunteer@school.edu.vn", "password": "123456"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Tài khoản tình nguyện viên đang chờ duyệt"


def test_login_active_user_returns_bearer_token(client, monkeypatch):
    monkeypatch.setattr(
        app,
        "login_user_account",
        lambda email, password: {
            "id": "student-1",
            "name": "Sinh viên E2E",
            "email": email,
            "role": "student",
            "status": "active",
            "points": 10,
        },
        raising=False,
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "student@school.edu.vn", "password": "123456"},
    )

    payload = response.json()
    assert response.status_code == 200
    assert payload["tokenType"] == "Bearer"
    assert app.verify_auth_token(payload["token"])["sub"] == "student-1"
    assert payload["user"]["email"] == "student@school.edu.vn"


def test_me_reads_bearer_token_and_returns_profile(client, monkeypatch):
    token = app.create_auth_token({"sub": "student-1", "role": "student"})
    monkeypatch.setattr(
        app,
        "get_user_account",
        lambda user_id: {
            "id": user_id,
            "name": "Sinh viên E2E",
            "email": "student@school.edu.vn",
            "role": "student",
            "status": "active",
            "points": 10,
        },
        raising=False,
    )

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["user"]["id"] == "student-1"


def test_change_password_requires_current_password(client, monkeypatch):
    token = app.create_auth_token({"sub": "student-1", "role": "student"})
    monkeypatch.setattr(
        app,
        "get_user_account",
        lambda user_id: {
            "id": user_id,
            "name": "Sinh viên E2E",
            "email": "student@school.edu.vn",
            "role": "student",
            "status": "active",
            "points": 10,
        },
        raising=False,
    )
    monkeypatch.setattr(
        app,
        "change_user_password",
        lambda user_id, current_password, new_password: (_ for _ in ()).throw(app.AuthError(400, "Mật khẩu hiện tại không đúng")),
        raising=False,
    )

    response = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "wrong", "newPassword": "654321"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Mật khẩu hiện tại không đúng"


def test_admin_can_approve_pending_volunteer(client, monkeypatch):
    token = app.create_auth_token({"sub": "admin-1", "role": "admin"})
    monkeypatch.setattr(
        app,
        "get_user_account",
        lambda user_id: {
            "id": user_id,
            "name": "Admin",
            "email": "admin@school.edu.vn",
            "role": "admin",
            "status": "active",
            "points": 0,
        },
        raising=False,
    )
    monkeypatch.setattr(
        app,
        "update_user_account_status",
        lambda user_id, status: {
            "id": user_id,
            "name": "Tình nguyện viên E2E",
            "email": "volunteer@school.edu.vn",
            "role": "volunteer",
            "status": status,
            "points": 0,
        },
        raising=False,
    )

    response = client.patch(
        "/api/users/volunteer-1/status",
        json={"status": "active"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["status"] == "active"
