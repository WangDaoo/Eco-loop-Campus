import psycopg
import pytest

from test_support.postgres import SEED_IDS


pytestmark = pytest.mark.postgres
TEST_PASSWORD = "TestPass-2026!"

EXPECTED_FACULTIES = [
    ("mechanical-engineering", "Khoa Cơ khí"),
    ("automotive-engineering", "Khoa Cơ khí động lực"),
    ("electrical-electronics", "Khoa Điện – Điện tử"),
    ("information-technology", "Khoa Công nghệ thông tin"),
    ("garment-fashion", "Khoa Công nghệ May và Thời trang"),
    ("chemical-environmental", "Khoa Công nghệ Hóa học và Môi trường"),
    ("economics", "Khoa Kinh tế"),
    ("foreign-languages", "Khoa Ngoại ngữ"),
    ("technical-education", "Khoa Sư phạm Kỹ thuật"),
    ("basic-sciences", "Khoa Khoa học cơ bản"),
    ("political-theory", "Khoa Lý luận chính trị"),
]


def valid_registration(**overrides):
    payload = {
        "name": "Nguyễn Sinh Viên",
        "email": "new.student@hyute.edu.vn",
        "password": TEST_PASSWORD,
        "role": "student",
        "studentCode": "SV20260001",
        "facultyCode": "information-technology",
        "phoneNumber": "0912345678",
    }
    payload.update(overrides)
    return payload


def test_faculty_catalog_returns_exact_active_hyute_dropdown_order(
    postgres_test_url, seed_operating_catalog, api_client
):
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update faculties set status = 'inactive' where code = 'political-theory'"
        )
        connection.commit()

    response = api_client.get("/api/catalog/faculties")

    assert response.status_code == 200
    rows = response.json()["data"]
    assert [(row["code"], row["name"]) for row in rows] == EXPECTED_FACULTIES[:-1]
    assert [row["sortOrder"] for row in rows] == list(range(1, 11))
    assert all(row["status"] == "active" for row in rows)


@pytest.mark.parametrize(
    ("role", "expected_status"), [("student", "active"), ("volunteer", "pending")]
)
def test_registration_persists_complete_faculty_only_profile(
    role, expected_status, postgres_test_url, seed_operating_catalog, api_client
):
    payload = valid_registration(
        role=role,
        email=f"new.{role}@utehy.edu.vn",
        studentCode=f"HYUTE{role[:3].upper()}2026",
    )

    response = api_client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    body = response.json()
    user = body["user"]
    assert user["status"] == expected_status
    if expected_status == "active":
        assert body["tokenType"] == "Bearer"
        assert body["token"]
    else:
        assert "token" not in body
    assert user["studentCode"] == payload["studentCode"]
    assert user["facultyCode"] == payload["facultyCode"]
    assert user["facultyName"] == "Khoa Công nghệ thông tin"
    assert user["phoneNumber"] == payload["phoneNumber"]
    assert user["profileCompleted"] is True
    assert user["requiresProfileCompletion"] is False
    assert not {
        "password",
        "passwordHash",
        "major",
        "specialization",
        "classCode",
        "cohort",
    }.intersection(user)
    with psycopg.connect(postgres_test_url) as connection:
        stored = connection.execute(
            """
            select student_code, faculty_code, phone_number, password_hash
            from users where id = %s
            """,
            (user["id"],),
        ).fetchone()
    assert stored[:3] == (
        payload["studentCode"].upper(),
        payload["facultyCode"],
        payload["phoneNumber"],
    )
    assert stored[3] != TEST_PASSWORD
    admin_login = api_client.post(
        "/api/auth/login",
        json={"email": "admin.test@hyute.edu.vn", "password": TEST_PASSWORD},
    )
    admin_rows = api_client.get(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {admin_login.json()['token']}"},
    ).json()["data"]
    admin_user = next(row for row in admin_rows if row["id"] == user["id"])
    assert admin_user["studentCode"] == user["studentCode"]
    assert admin_user["facultyCode"] == user["facultyCode"]
    assert admin_user["phoneNumber"] == user["phoneNumber"]


@pytest.mark.parametrize("missing", ["studentCode", "facultyCode", "phoneNumber"])
def test_registration_requires_each_profile_field(
    missing, postgres_test_url, seed_operating_catalog, api_client
):
    payload = valid_registration()
    payload.pop(missing)

    response = api_client.post("/api/auth/register", json=payload)

    assert response.status_code == 422
    with psycopg.connect(postgres_test_url) as connection:
        assert connection.execute(
            "select count(*) from users where email = 'new.student@hyute.edu.vn'"
        ).fetchone()[0] == 0


@pytest.mark.parametrize(
    ("updates", "expected_detail"),
    [
        ({"email": "student@gmail.com"}, "INVALID_SCHOOL_EMAIL"),
        ({"email": "not-an-email"}, "INVALID_SCHOOL_EMAIL"),
        ({"studentCode": "x"}, "INVALID_STUDENT_CODE"),
        ({"facultyCode": "unknown-faculty"}, "INVALID_FACULTY"),
        ({"phoneNumber": "123"}, "INVALID_PHONE_NUMBER"),
        ({"role": "admin"}, "INVALID_REGISTRATION_ROLE"),
    ],
)
def test_registration_rejects_invalid_profile_contract(
    updates,
    expected_detail,
    postgres_test_url,
    seed_operating_catalog,
    api_client,
):
    response = api_client.post(
        "/api/auth/register", json=valid_registration(**updates)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == expected_detail


def test_student_code_is_unique_case_insensitively(
    postgres_test_url, seed_operating_catalog, api_client
):
    first = api_client.post(
        "/api/auth/register", json=valid_registration(studentCode="Hyute2026001")
    )
    second = api_client.post(
        "/api/auth/register",
        json=valid_registration(
            email="another.student@hyute.edu.vn", studentCode="hyute2026001"
        ),
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "STUDENT_CODE_EXISTS"


def test_legacy_student_must_complete_profile_before_business_actions(
    postgres_test_url, seed_operating_catalog, api_client
):
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            """
            update users
            set student_code = null, faculty_code = null, phone_number = null
            where id = %s
            """,
            (SEED_IDS["student_a"],),
        )
        connection.commit()
    login = api_client.post(
        "/api/auth/login",
        json={"email": "student.a@hyute.edu.vn", "password": TEST_PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["user"]["requiresProfileCompletion"] is True
    headers = {"Authorization": f"Bearer {login.json()['token']}"}
    blocked = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=headers,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "PROFILE_INCOMPLETE"

    completed = api_client.patch(
        "/api/users/me/profile",
        headers=headers,
        json={
            "studentCode": "SVLEGACY2026",
            "facultyCode": "mechanical-engineering",
            "phoneNumber": "0987654321",
        },
    )
    assert completed.status_code == 200
    assert completed.json()["user"]["requiresProfileCompletion"] is False
    allowed = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=headers,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    )
    assert allowed.status_code == 201
