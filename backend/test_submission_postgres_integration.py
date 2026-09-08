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


@pytest.fixture(autouse=True)
def isolate_submission_uploads(monkeypatch, tmp_path):
    import app as backend_app

    monkeypatch.setattr(backend_app, "PROOF_UPLOADS_DIR", tmp_path / "proofs")


def post_submission(api_client, headers, *, quantity=1, bin_id=None, waste_type_id=None):
    return api_client.post(
        "/api/mobile/recycling-submissions",
        headers=headers,
        data={
            "binId": bin_id or SEED_IDS["bin_a"],
            "wasteTypeId": waste_type_id or SEED_IDS["waste_plastic"],
            "quantity": "" if quantity is None else str(quantity),
        },
        files={"proof": ("student-proof.jpg", b"student-proof-content", "image/jpeg")},
    )


def create_and_scan_submission(api_client):
    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer_headers = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    create_response = post_submission(api_client, student_headers)
    assert create_response.status_code == 201
    submission = create_response.json()["data"]["submission"]
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

    created_response = post_submission(api_client, student, quantity=2)
    assert created_response.status_code == 201
    created = created_response.json()["data"]["submission"]
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
    confirmed_data = confirmed.json()["data"]
    assert confirmed_data["status"] == "POINT_CONFIRMED"
    assert confirmed_data["points"] == 15
    assert confirmed_data["submissionId"] == created["id"]
    assert confirmed_data["submission"]["id"] == created["id"]
    assert confirmed_data["submission"]["status"] == "POINT_CONFIRMED"
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

    response = post_submission(api_client, student, quantity=quantity)

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

    response = post_submission(api_client, student)

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
        created = post_submission(api_client, student).json()["data"]["submission"]
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
            "select count(*) from proof_images where submission_id = %s and kind = 'REVIEWER_PROOF'",
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


def test_submission_is_created_with_student_proof_and_scan_returns_canonical_row(
    postgres_test_url, seed_operating_catalog
):
    with psycopg.connect(postgres_test_url) as connection:
        created = connection.execute(
            """
            select create_recycling_submission_with_proof(
              %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                SEED_IDS["student_a"],
                SEED_IDS["bin_a"],
                SEED_IDS["waste_plastic"],
                2,
                "proof-student-1",
                "/uploads/proofs/student-proof.jpg",
                "student-proof-hash",
                "student-proof.jpg",
                None,
            ),
        ).fetchone()[0]
        scanned = connection.execute(
            "select scan_recycling_qr(%s, %s, %s)",
            (
                created["submission"]["qrToken"],
                SEED_IDS["volunteer_a"],
                SEED_IDS["bin_a"],
            ),
        ).fetchone()[0]
        connection.commit()

    assert created["submission"]["status"] == "CREATED"
    assert len(created["submission"]["proofImages"]) == 1
    student_proof = created["submission"]["proofImages"][0]
    assert student_proof["id"] == "proof-student-1"
    assert student_proof["submissionId"] == created["submission"]["id"]
    assert student_proof["kind"] == "STUDENT_PROOF"
    assert student_proof["status"] == "pending"
    assert student_proof["imageName"] == "student-proof.jpg"
    assert student_proof["imageUrl"] == "/uploads/proofs/student-proof.jpg"
    assert student_proof["imageHash"] == "student-proof-hash"
    assert student_proof["uploadedBy"] == SEED_IDS["student_a"]
    assert student_proof["capturedAt"]
    assert scanned["result"] == "SUCCESS"
    assert scanned["submission"]["id"] == created["submission"]["id"]
    assert scanned["submission"]["status"] == "QR_SCANNED"
    assert scanned["submission"]["verifiedBy"] == SEED_IDS["volunteer_a"]


def test_submission_with_proof_rejects_missing_image_without_partial_write(
    postgres_test_url, seed_operating_catalog
):
    with psycopg.connect(postgres_test_url) as connection:
        with pytest.raises(psycopg.errors.RaiseException, match="PROOF_IMAGE_REQUIRED"):
            connection.execute(
                """
                select create_recycling_submission_with_proof(
                  %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    SEED_IDS["student_a"],
                    SEED_IDS["bin_a"],
                    SEED_IDS["waste_plastic"],
                    1,
                    None,
                    None,
                    None,
                    None,
                    None,
                ),
            )
        connection.rollback()
        assert connection.execute("select count(*) from recycling_submissions").fetchone()[0] == 0


def test_manual_review_requires_audit_and_rejection_creates_student_notification(
    postgres_test_url, seed_operating_catalog, api_client
):
    with psycopg.connect(postgres_test_url) as connection:
        created = connection.execute(
            """
            select create_recycling_submission_with_proof(
              %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                SEED_IDS["student_a"],
                SEED_IDS["bin_a"],
                SEED_IDS["waste_plastic"],
                1,
                "proof-student-2",
                "/uploads/proofs/student-proof-2.jpg",
                "student-proof-hash-2",
                "student-proof-2.jpg",
                None,
            ),
        ).fetchone()[0]
        submission_id = created["submission"]["id"]
        connection.commit()

        with pytest.raises(psycopg.errors.RaiseException, match="MANUAL_REVIEW_REASON_REQUIRED"):
            connection.execute(
                "select unlock_recycling_manual_review(%s, %s, %s, %s)",
                (submission_id, SEED_IDS["volunteer_a"], "", None),
            )
        connection.rollback()

        unlocked = connection.execute(
            "select unlock_recycling_manual_review(%s, %s, %s, %s)",
            (
                submission_id,
                SEED_IDS["volunteer_a"],
                "Camera không nhận được mã QR trên màn hình",
                None,
            ),
        ).fetchone()[0]
        connection.commit()
        with pytest.raises(psycopg.errors.RaiseException, match="REJECTION_NOTE_REQUIRED"):
            connection.execute(
                "select reject_recycling_submission(%s, %s, %s)",
                (submission_id, SEED_IDS["volunteer_a"], "  "),
            )
        connection.rollback()

        rejected = connection.execute(
            "select reject_recycling_submission(%s, %s, %s)",
            (
                submission_id,
                SEED_IDS["volunteer_a"],
                "Ảnh không chứng minh đúng loại rác đã khai báo",
            ),
        ).fetchone()[0]
        notification = connection.execute(
            """
            select id, type, message, reference_type, reference_id
            from notifications
            where user_id = %s
            """,
            (SEED_IDS["student_a"],),
        ).fetchone()
        connection.commit()

    assert unlocked["submission"]["status"] == "PENDING_REVIEW"
    assert unlocked["submission"]["manualReviewReason"] == "Camera không nhận được mã QR trên màn hình"
    assert rejected["submission"]["status"] == "REJECTED"
    assert rejected["submission"]["volunteerNote"] == "Ảnh không chứng minh đúng loại rác đã khai báo"
    assert notification[1:] == (
        "SUBMISSION_REJECTED",
        "Ảnh không chứng minh đúng loại rác đã khai báo",
        "recycling_submission",
        submission_id,
    )

    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")
    initial_data = api_client.get("/api/mobile/initial-data", headers=student_headers)
    assert initial_data.status_code == 200
    student_notification = next(
        row for row in initial_data.json()["notifications"] if row["id"] == notification[0]
    )
    assert student_notification["message"] == "Ảnh không chứng minh đúng loại rác đã khai báo"
    assert student_notification["readAt"] is None

    marked_read = api_client.patch(
        f"/api/mobile/notifications/{notification[0]}/read", headers=student_headers
    )
    assert marked_read.status_code == 200
    assert marked_read.json()["data"]["readAt"] is not None


def test_manual_review_confirmation_awards_points_exactly_once(
    postgres_test_url, seed_operating_catalog
):
    disable_missions(postgres_test_url)
    with psycopg.connect(postgres_test_url) as connection:
        created = connection.execute(
            """
            select create_recycling_submission_with_proof(
              %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                SEED_IDS["student_a"],
                SEED_IDS["bin_a"],
                SEED_IDS["waste_plastic"],
                2,
                "proof-manual-confirm",
                "/uploads/proofs/manual-confirm.jpg",
                "manual-confirm-hash",
                "manual-confirm.jpg",
                None,
            ),
        ).fetchone()[0]
        submission_id = created["submission"]["id"]
        connection.execute(
            "select unlock_recycling_manual_review(%s, %s, %s, %s)",
            (
                submission_id,
                SEED_IDS["volunteer_a"],
                "Màn hình sinh viên bị vỡ nên camera không đọc được QR",
                None,
            ),
        )
        confirmed = connection.execute(
            "select confirm_recycling_submission(%s, %s, %s::numeric, %s)",
            (submission_id, SEED_IDS["volunteer_a"], 1.5, "Duyệt từ ảnh sinh viên"),
        ).fetchone()[0]
        connection.commit()

        with pytest.raises(psycopg.errors.RaiseException, match="INVALID_SUBMISSION_STATUS"):
            connection.execute(
                "select confirm_recycling_submission(%s, %s, %s::numeric, %s)",
                (submission_id, SEED_IDS["volunteer_a"], 1.5, "Gọi lặp"),
            )
        connection.rollback()
        point_rows = connection.execute(
            "select points from point_history where submission_id = %s",
            (submission_id,),
        ).fetchall()

    assert confirmed["status"] == "POINT_CONFIRMED"
    assert confirmed["points"] == 15
    assert point_rows == [(15,)]


def test_pending_review_without_unlock_audit_cannot_be_confirmed_or_rejected(
    postgres_test_url, seed_operating_catalog
):
    with psycopg.connect(postgres_test_url) as connection:
        created = connection.execute(
            """
            select create_recycling_submission_with_proof(
              %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                SEED_IDS["student_a"],
                SEED_IDS["bin_a"],
                SEED_IDS["waste_plastic"],
                1,
                "proof-crafted-pending",
                "/uploads/proofs/crafted-pending.jpg",
                "crafted-pending-hash",
                "crafted-pending.jpg",
                None,
            ),
        ).fetchone()[0]
        submission_id = created["submission"]["id"]
        connection.execute(
            """
            update recycling_submissions
            set status = 'PENDING_REVIEW', verified_by = %s
            where id = %s
            """,
            (SEED_IDS["volunteer_a"], submission_id),
        )
        connection.commit()

        with pytest.raises(psycopg.errors.RaiseException, match="MANUAL_REVIEW_NOT_UNLOCKED"):
            connection.execute(
                "select confirm_recycling_submission(%s, %s, %s::numeric, %s)",
                (submission_id, SEED_IDS["volunteer_a"], 1, "Không có audit mở khóa"),
            )
        connection.rollback()

        with pytest.raises(psycopg.errors.RaiseException, match="MANUAL_REVIEW_NOT_UNLOCKED"):
            connection.execute(
                "select reject_recycling_submission(%s, %s, %s)",
                (submission_id, SEED_IDS["volunteer_a"], "Không có audit mở khóa"),
            )
