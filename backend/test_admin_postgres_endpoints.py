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

def test_admin_point_adjustments_route_is_not_captured_by_resource_route(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    captured = {}

    def fake_adjust(admin_id, payload):
        captured["admin_id"] = admin_id
        captured["payload"] = payload
        return {"userId": payload["userId"], "points": payload["points"], "balanceAfter": 107}

    monkeypatch.setattr(app, "adjust_manual_points_account", fake_adjust, raising=False)

    response = client.post(
        "/api/admin/point-adjustments",
        json={"userId": "student-1", "points": 7, "reason": "UAT manual point"},
        headers=bearer("admin"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["balanceAfter"] == 107
    assert captured["admin_id"] == "admin-1"
    assert captured["payload"]["userId"] == "student-1"

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

def test_admin_bin_contents_lists_current_waste_and_collection_history(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    monkeypatch.setattr(
        app,
        "get_admin_bin_contents",
        lambda bin_id: {
            "binId": bin_id,
            "lastCollectedAt": "2026-09-13T08:00:00+00:00",
            "totalQuantity": 3,
            "items": [
                {"wasteTypeId": "plastic", "wasteTypeName": "Nhựa", "quantity": 2, "unit": "chai"},
                {"wasteTypeId": "paper", "wasteTypeName": "Giấy", "quantity": 1, "unit": "kg"},
            ],
            "collections": [
                {"id": "collection-1", "collectedAt": "2026-09-13T08:00:00+00:00", "collectedBy": "admin-1", "note": ""},
            ],
        },
        raising=False,
    )

    response = client.get("/api/admin/bins/bin-1/contents", headers=bearer("admin"))

    assert response.status_code == 200
    assert response.json()["data"]["binId"] == "bin-1"
    assert response.json()["data"]["items"][0]["quantity"] == 2
    assert len(response.json()["data"]["collections"]) == 1

def test_admin_bin_contents_bootstraps_missing_collection_table(monkeypatch):
    executed = []

    class FakeCursor:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def execute(self, query, params=()):
            executed.append(str(query))

        def fetchone(self):
            query = executed[-1].lower()
            if "select id from bins" in query:
                return ["bin-1"]
            if "max(collected_at)" in query:
                return [None]
            return [None]

        def fetchall(self):
            return []

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def cursor(self):
            return FakeCursor()

    monkeypatch.setattr(app, "require_database_url", lambda: "postgresql://test", raising=False)
    monkeypatch.setattr(app.psycopg, "connect", lambda _url: FakeConnection(), raising=False)

    result = app.get_admin_bin_contents("bin-1")

    assert result["binId"] == "bin-1"
    create_index = next(index for index, query in enumerate(executed) if "create table if not exists bin_collections" in query.lower())
    max_query_index = next(index for index, query in enumerate(executed) if "max(collected_at)" in query.lower())
    assert create_index < max_query_index

def test_admin_collect_bin_creates_collection_without_deleting_submission_history(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    captured = {}

    def fake_collect(actor_id, bin_id, payload):
        captured.update({"actorId": actor_id, "binId": bin_id, "payload": payload})
        return {
            "id": "collection-2",
            "binId": bin_id,
            "collectedBy": actor_id,
            "collectedAt": "2026-09-13T09:00:00+00:00",
            "note": "Đã thu gom",
        }

    monkeypatch.setattr(app, "collect_admin_bin", fake_collect, raising=False)

    response = client.post(
        "/api/admin/bins/bin-1/collect",
        json={"note": "Đã thu gom"},
        headers=bearer("admin"),
    )

    assert response.status_code == 200
    assert response.json()["data"]["id"] == "collection-2"
    assert captured == {"actorId": "admin-1", "binId": "bin-1", "payload": {"note": "Đã thu gom"}}

def test_admin_resource_whitelists_point_history():
    config = app.admin_resource_config("point-history")

    assert config["table"] == "point_history"
    assert "user_id" in config["columns"]


def test_admin_student_contribution_report_aggregates_students_and_days(monkeypatch):
    class FakeCursor:
        def __init__(self):
            self.query_index = -1
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def execute(self, query, params=()):
            self.query_index += 1
            self.params = params
        def fetchall(self):
            datasets = [
                [
                    ("student-1", "Nguyễn Văn An", "10123001@school.edu.vn", "10123001", "information-technology", "Khoa Công nghệ thông tin", "12523W.4", 30),
                    ("student-2", "Trần Thị Bình", "10123002@school.edu.vn", "10123002", "economics", "Khoa Kinh tế", "12523W.4", 5),
                ],
                [
                    ("sub-1", "student-1", "2026-09-10"),
                    ("sub-2", "student-1", "2026-09-11"),
                ],
                [("ph-1", "student-1", 12, "2026-09-10")],
                [("fb-1", "2026-09-10")],
                [("rw-1", "student-1", "Bình nước x1", "2026-09-11")],
            ]
            return datasets[self.query_index]
    class FakeConnection:
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def cursor(self):
            return FakeCursor()
    monkeypatch.setattr(app, "require_database_url", lambda: "postgresql://test", raising=False)
    monkeypatch.setattr(app.psycopg, "connect", lambda _url: FakeConnection(), raising=False)

    report = app.build_student_contribution_report("2026-09-01", "2026-09-30")

    assert report["summary"] == {
        "totalContributions": 2,
        "activeStudents": 1,
        "totalPoints": 12,
        "averageContributionsPerDay": 1,
    }
    assert report["studentRows"][0] == {
        "id": "student-1",
        "fullName": "Nguyễn Văn An",
        "studentCode": "10123001",
        "faculty": "Khoa Công nghệ thông tin",
            "group": "12523W.4",
            "contributionCount": 2,
            "totalPoints": 12,
            "rewardSummary": "Bình nước x1",
        }
    assert report["dailyRows"][0] == {
        "date": "2026-09-10",
        "contributions": 1,
        "activeStudents": 1,
        "points": 12,
        "feedback": 1,
        "rewardRedemptions": 0,
    }


def test_admin_student_contribution_report_export_csv_and_xlsx(client, monkeypatch):
    patch_current_user(monkeypatch, "admin")
    report = {
        "filters": {"dateFrom": "2026-09-01", "dateTo": "2026-09-30"},
        "summary": {"totalContributions": 1, "activeStudents": 1, "totalPoints": 5, "averageContributionsPerDay": 1},
        "dailyRows": [],
        "studentRows": [
            {"id": "student-1", "fullName": "Nguyễn Văn An", "studentCode": "10123001", "faculty": "Khoa Công nghệ thông tin", "group": "12523W.4", "contributionCount": 1, "totalPoints": 5},
        ],
    }
    monkeypatch.setattr(app, "build_student_contribution_report", lambda date_from=None, date_to=None: report, raising=False)

    csv_response = client.get("/api/admin/reports/student-contributions/export?format=csv", headers=bearer("admin"))
    xlsx_response = client.get("/api/admin/reports/student-contributions/export?format=xlsx", headers=bearer("admin"))

    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")
    assert csv_response.content.startswith(b"\xef\xbb\xbf")
    assert "Nguyễn Văn An" in csv_response.text
    assert xlsx_response.status_code == 200
    assert xlsx_response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert xlsx_response.content.startswith(b"PK")
