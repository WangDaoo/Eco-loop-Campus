import pytest
from fastapi.testclient import TestClient

import app


@pytest.fixture()
def client():
    with TestClient(app.app) as test_client:
        yield test_client


def bearer(role="admin", subject=None):
    user_id = subject or f"{role}-1"
    return {"Authorization": f"Bearer {app.create_auth_token({'sub': user_id, 'role': role})}"}


def patch_current_user(monkeypatch, role="admin"):
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


def test_admin_resource_blocks_student(client, monkeypatch):
    patch_current_user(monkeypatch, "student")

    response = client.get("/api/admin/bins", headers=bearer("student"))

    assert response.status_code == 403


def test_admin_resource_lists_bins_for_admin(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    monkeypatch.setattr(
        app,
        "list_admin_resource",
        lambda resource: [{"id": "bin-e1", "name": "Trạm E1", "binGroup": "recycle"}],
        raising=False,
    )

    response = client.get("/api/admin/bins", headers=bearer("admin"))

    assert response.status_code == 200
    assert response.json()["data"][0]["id"] == "bin-e1"


def test_admin_resource_upserts_waste_type_for_admin(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    captured = {}

    def fake_save_admin_resource(resource, payload):
        captured["resource"] = resource
        captured["payload"] = payload
        return {"id": "paper", "name": "Giấy", "pointPerUnit": 5}

    monkeypatch.setattr(app, "save_admin_resource", fake_save_admin_resource, raising=False)

    response = client.post(
        "/api/admin/waste-types",
        json={"id": "paper", "name": "Giấy", "pointPerUnit": 5},
        headers=bearer("admin"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["id"] == "paper"
    assert captured["resource"] == "waste-types"
    assert captured["payload"]["pointPerUnit"] == 5


def test_admin_resource_deletes_reward_for_admin(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    monkeypatch.setattr(app, "delete_admin_resource", lambda resource, item_id: {"ok": True}, raising=False)

    response = client.delete("/api/admin/rewards/reward-1", headers=bearer("admin"))

    assert response.status_code == 200
    assert response.json() == {"ok": True}

def test_admin_resource_whitelists_reward_categories():
    config = app.admin_resource_config("reward-categories")

    assert config["table"] == "reward_categories"
    assert "name" in config["columns"]
    assert "status" in config["writable"]

def test_admin_resource_exposes_reward_category_fields():
    config = app.admin_resource_config("rewards")

    assert "category_id" in config["columns"]
    assert "category_name" in config["columns"]
    assert "category_id" in config["writable"]

def test_admin_delete_blocks_reward_category_in_use(monkeypatch):
    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, query, params=()):
            self.query = query

        def fetchone(self):
            return [1]

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def cursor(self):
            return FakeCursor()

    monkeypatch.setattr(app, "require_database_url", lambda: "postgresql://test", raising=False)
    monkeypatch.setattr(app.psycopg, "connect", lambda _url: FakeConnection(), raising=False)

    with pytest.raises(app.HTTPException) as error:
        app.delete_admin_resource("reward-categories", "cat-1")

    assert error.value.status_code == 409

def test_admin_resource_lists_point_history_for_admin(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    monkeypatch.setattr(
        app,
        "list_admin_resource",
        lambda resource: [{"id": 1, "userId": "student-1", "points": 10}],
        raising=False,
    )

    response = client.get("/api/admin/point-history", headers=bearer("admin"))

    assert response.status_code == 200
    assert response.json()["data"][0]["userId"] == "student-1"


def test_admin_resource_rejects_unknown_resource(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")

    response = client.get("/api/admin/not-a-table", headers=bearer("admin"))

    assert response.status_code == 404

def test_admin_resource_whitelists_point_history():
    config = app.admin_resource_config("point-history")

    assert config["table"] == "point_history"
    assert "user_id" in config["columns"]
