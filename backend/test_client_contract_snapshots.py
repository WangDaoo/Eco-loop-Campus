import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

import app


FIXTURES = json.loads(
    (Path(__file__).resolve().parent.parent / "contracts" / "backend_contract_fixtures.json").read_text(encoding="utf-8")
)


def test_user_serializer_matches_shared_client_contract():
    timestamp = datetime(2026, 9, 5, 1, 2, 3, tzinfo=timezone.utc)
    row = (
        "student-contract-1", "Nguyễn Ánh Dương", "anh.duong@hyute.edu.vn", "student",
        "Khoa Công nghệ thông tin", 125, "active", None, None, timestamp, timestamp,
        "SV20260001", "information-technology", "Khoa Công nghệ thông tin", "0912345678",
    )
    assert app.to_user_profile(row) == FIXTURES["user"]


@pytest.mark.parametrize("fixture_name,resource", [
    ("submission", "recycling-submissions"),
    ("pointHistory", "point-history"),
])
def test_admin_serializers_match_shared_client_contract(fixture_name, resource):
    expected = FIXTURES[fixture_name]
    columns = app.ADMIN_RESOURCES[resource]["columns"]
    snake_values = {column: expected.get(app.to_camel_field(column)) for column in columns}
    assert app.admin_row_to_json(columns, tuple(snake_values[column] for column in columns)) == expected


def test_reward_batch_serializer_preserves_items_and_nullable_timestamps():
    expected = FIXTURES["rewardBatch"]
    batch = {key: expected[key] for key in (
        "id", "studentId", "qrToken", "createdAt", "expiresAt", "status", "scannedBy",
        "scannedAt", "fulfilledAt", "updatedAt", "items",
    )}
    assert app.mobile_reward_batch_row(batch) == expected


def test_error_code_contract_is_stable():
    for error in FIXTURES["errors"]:
        assert app.error_code_for(error["status"], error["detail"]) == error["code"]


def test_http_and_validation_errors_return_detail_and_code(api_client, monkeypatch):
    missing_token = api_client.get("/api/auth/me")
    assert missing_token.status_code == 401
    assert missing_token.json() == {"detail": "Thiếu token đăng nhập", "code": "HTTP_401"}

    invalid = api_client.post("/api/auth/register", json={})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "VALIDATION_ERROR"

    monkeypatch.setattr(app, "get_database_url", lambda: "")
    unavailable = api_client.get("/api/catalog/faculties")
    assert unavailable.status_code == 503
    assert unavailable.json() == {"detail": "DATABASE_URL chưa cấu hình", "code": "HTTP_503"}
