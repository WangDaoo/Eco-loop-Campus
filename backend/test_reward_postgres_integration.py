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


def create_batch(api_client, headers, items=None):
    response = api_client.post(
        "/api/mobile/reward-redemptions",
        headers=headers,
        json={
            "items": items
            or [{"rewardId": SEED_IDS["reward_voucher"], "quantity": 1}]
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def read_reward_state(database_url, batch_id):
    with psycopg.connect(database_url) as connection:
        batch = connection.execute(
            """
            select status, scanned_by, scanned_at, fulfilled_at
            from reward_redemption_batches where id = %s
            """,
            (batch_id,),
        ).fetchone()
        points = {
            row[0]: row[1]
            for row in connection.execute(
                "select id, points from users where id in (%s, %s)",
                (SEED_IDS["student_a"], SEED_IDS["student_b"]),
            ).fetchall()
        }
        stocks = {
            row[0]: row[1]
            for row in connection.execute(
                "select id, stock from rewards where id in (%s, %s)",
                (SEED_IDS["reward_voucher"], SEED_IDS["reward_bottle"]),
            ).fetchall()
        }
        history = connection.execute(
            """
            select source, points from point_history
            where reference_type = 'reward_redemption_batch' and reference_id = %s
            order by created_at, id
            """,
            (batch_id,),
        ).fetchall()
    return batch, points, stocks, history


def test_create_batch_keeps_balance_and_stock_until_handover(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")

    batch = create_batch(
        api_client,
        student,
        [
            {"rewardId": SEED_IDS["reward_voucher"], "quantity": 2},
            {"rewardId": SEED_IDS["reward_bottle"], "quantity": 1},
        ],
    )

    assert batch["status"] == "pending"
    assert batch["totalPoints"] == 450
    _, points, stocks, history = read_reward_state(postgres_test_url, batch["id"])
    assert points[SEED_IDS["student_a"]] == 1000
    assert stocks == {
        SEED_IDS["reward_voucher"]: 3,
        SEED_IDS["reward_bottle"]: 2,
    }
    assert history == []
    with psycopg.connect(postgres_test_url) as connection:
        items = connection.execute(
            """
            select reward_id, reward_title, quantity, points_each, points_total
            from reward_redemption_items where batch_id = %s order by reward_id
            """,
            (batch["id"],),
        ).fetchall()
    assert items == [
        (SEED_IDS["reward_bottle"], "Bình nước test", 1, 250, 250),
        (SEED_IDS["reward_voucher"], "Voucher test", 2, 100, 200),
    ]


def test_create_rejects_a_second_active_batch_and_keeps_a_bounded_qr_ttl(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    batch = create_batch(api_client, student)

    duplicate = api_client.post(
        "/api/mobile/reward-redemptions",
        headers=student,
        json={
            "items": [{"rewardId": SEED_IDS["reward_bottle"], "quantity": 1}]
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "ACTIVE_REWARD_BATCH_EXISTS"
    with psycopg.connect(postgres_test_url) as connection:
        ttl_seconds, count = connection.execute(
            """
            select extract(epoch from (expires_at - created_at)),
                   count(*) over ()
            from reward_redemption_batches where id = %s
            """,
            (batch["id"],),
        ).fetchone()
    assert 899 <= float(ttl_seconds) <= 901
    assert count == 1


@pytest.mark.parametrize("quantity", [0, -1, 1.5, None, "not-a-number"])
def test_create_batch_rejects_invalid_quantity_without_partial_write(
    quantity, postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")

    response = api_client.post(
        "/api/mobile/reward-redemptions",
        headers=student,
        json={
            "items": [
                {"rewardId": SEED_IDS["reward_voucher"], "quantity": quantity}
            ]
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "INVALID_REWARD_QUANTITY"
    with psycopg.connect(postgres_test_url) as connection:
        assert connection.execute(
            "select count(*) from reward_redemption_batches"
        ).fetchone()[0] == 0
        assert connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0] == 1000
        assert connection.execute(
            "select stock from rewards where id = %s",
            (SEED_IDS["reward_voucher"],),
        ).fetchone()[0] == 3


def test_scan_is_atomic_handover_and_fulfills_immediately(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    batch = create_batch(api_client, student)

    response = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "fulfilled"
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "fulfilled"
    assert state[1] == SEED_IDS["volunteer_a"]
    assert state[2] is not None
    assert state[3] is not None
    assert points[SEED_IDS["student_a"]] == 900
    assert stocks[SEED_IDS["reward_voucher"]] == 2
    assert history == [("reward_redemption", -100)]


def test_invalid_and_replayed_qr_return_stable_errors_without_double_spending(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    missing = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": "ECL-REWARD-DOES-NOT-EXIST"},
    )
    assert missing.status_code == 404
    assert missing.json()["detail"] == "REWARD_BATCH_NOT_FOUND"
    batch = create_batch(api_client, student)
    first = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )
    replay = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )

    assert first.status_code == 200
    assert replay.status_code == 409
    assert replay.json()["detail"] == "REWARD_BATCH_ALREADY_PROCESSED"
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "fulfilled"
    assert points[SEED_IDS["student_a"]] == 900
    assert stocks[SEED_IDS["reward_voucher"]] == 2
    assert history == [("reward_redemption", -100)]


def test_token_from_a_newly_locked_volunteer_cannot_handover_a_reward(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    batch = create_batch(api_client, student)
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update users set status = 'locked' where id = %s",
            (SEED_IDS["volunteer_a"],),
        )
        connection.commit()

    response = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )

    assert response.status_code == 403
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "pending"
    assert points[SEED_IDS["student_a"]] == 1000
    assert stocks[SEED_IDS["reward_voucher"]] == 3
    assert history == []


@pytest.mark.parametrize(
    ("case", "expected_status", "expected_detail"),
    [
        ("missing", 404, "REWARD_NOT_FOUND"),
        ("inactive", 404, "REWARD_NOT_FOUND"),
        ("out-of-stock", 409, "REWARD_OUT_OF_STOCK"),
        ("duplicate", 400, "DUPLICATE_REWARD_ITEM"),
    ],
)
def test_create_batch_rejects_invalid_catalog_items_without_partial_write(
    case,
    expected_status,
    expected_detail,
    postgres_test_url,
    seed_operating_catalog,
    api_client,
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    reward_id = SEED_IDS["reward_voucher"]
    items = [{"rewardId": reward_id, "quantity": 1}]
    with psycopg.connect(postgres_test_url) as connection:
        if case == "inactive":
            connection.execute(
                "update rewards set status = 'inactive' where id = %s", (reward_id,)
            )
        elif case == "out-of-stock":
            connection.execute(
                "update rewards set stock = 0 where id = %s", (reward_id,)
            )
        elif case == "missing":
            items[0]["rewardId"] = "REWARD-DOES-NOT-EXIST"
        elif case == "duplicate":
            items.append({"rewardId": reward_id, "quantity": 1})
        connection.commit()

    response = api_client.post(
        "/api/mobile/reward-redemptions",
        headers=student,
        json={"items": items},
    )

    assert response.status_code == expected_status
    assert response.json()["detail"] == expected_detail
    with psycopg.connect(postgres_test_url) as connection:
        assert connection.execute(
            "select count(*) from reward_redemption_batches"
        ).fetchone()[0] == 0
        assert connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0] == 1000


def test_expired_qr_is_persisted_without_spending_points_or_stock(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    batch = create_batch(api_client, student)
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update reward_redemption_batches set expires_at = now() - interval '1 minute' where id = %s",
            (batch["id"],),
        )
        connection.commit()

    response = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "REWARD_BATCH_EXPIRED"
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "expired"
    assert points[SEED_IDS["student_a"]] == 1000
    assert stocks[SEED_IDS["reward_voucher"]] == 3
    assert history == []


def test_balance_change_after_create_rolls_back_the_entire_handover(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    batch = create_batch(api_client, student)
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update users set points = 50 where id = %s", (SEED_IDS["student_a"],)
        )
        connection.commit()

    response = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "INSUFFICIENT_POINTS"
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "pending"
    assert points[SEED_IDS["student_a"]] == 50
    assert stocks[SEED_IDS["reward_voucher"]] == 3
    assert history == []


def test_admin_cancellation_refunds_points_and_stock_exactly_once(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    admin = login_headers(api_client, "admin.test@hyute.edu.vn")
    batch = create_batch(
        api_client,
        student,
        [
            {"rewardId": SEED_IDS["reward_voucher"], "quantity": 2},
            {"rewardId": SEED_IDS["reward_bottle"], "quantity": 1},
        ],
    )
    scan = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )
    assert scan.status_code == 200

    cancelled = api_client.post(
        f"/api/admin/reward-redemption-batches/{batch['id']}/finalize",
        headers=admin,
        json={"status": "cancelled", "note": "Quà lỗi, hoàn tác"},
    )
    replay = api_client.post(
        f"/api/admin/reward-redemption-batches/{batch['id']}/finalize",
        headers=admin,
        json={"status": "cancelled", "note": "Lặp lại"},
    )

    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"
    assert replay.status_code == 400
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "cancelled"
    assert points[SEED_IDS["student_a"]] == 1000
    assert stocks == {
        SEED_IDS["reward_voucher"]: 3,
        SEED_IDS["reward_bottle"]: 2,
    }
    assert history == [
        ("reward_redemption", -450),
        ("reward_refund", 450),
    ]


def test_reward_status_is_consistent_in_student_and_admin_views(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    admin = login_headers(api_client, "admin.test@hyute.edu.vn")
    batch = create_batch(api_client, student)
    scan = api_client.post(
        "/api/mobile/reward-redemptions/scan",
        headers=volunteer,
        json={"qrToken": batch["qrToken"]},
    )
    assert scan.status_code == 200

    mobile_rows = api_client.get(
        "/api/mobile/initial-data", headers=student
    ).json()["rewardRedemptions"]
    admin_rows = api_client.get(
        "/api/admin/reward-redemption-batches", headers=admin
    ).json()["data"]
    mobile_batch = next(row for row in mobile_rows if row["id"] == batch["id"])
    admin_batch = next(row for row in admin_rows if row["id"] == batch["id"])

    assert mobile_batch["status"] == admin_batch["status"] == "fulfilled"
    assert mobile_batch["userId"] == admin_batch["studentId"] == SEED_IDS["student_a"]
    assert mobile_batch["totalPoints"] == 100
    assert mobile_batch["items"][0]["rewardTitle"] == "Voucher test"
    assert admin_batch["items"][0]["rewardTitle"] == "Voucher test"


def test_two_concurrent_scans_of_one_qr_have_one_winner(
    postgres_test_url, seed_operating_catalog, api_client
):
    student = login_headers(api_client, "student.a@hyute.edu.vn")
    batch = create_batch(api_client, student)

    def scan(actor_id):
        try:
            with psycopg.connect(postgres_test_url) as connection:
                result = connection.execute(
                    "select scan_reward_redemption_batch(%s, %s)",
                    (batch["qrToken"], actor_id),
                ).fetchone()[0]
                connection.commit()
                return result["status"]
        except Exception as error:
            return str(error).strip().splitlines()[0]

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                scan, [SEED_IDS["volunteer_a"], SEED_IDS["volunteer_b"]]
            )
        )

    assert sorted(results) == ["REWARD_BATCH_ALREADY_PROCESSED", "fulfilled"]
    state, points, stocks, history = read_reward_state(
        postgres_test_url, batch["id"]
    )
    assert state[0] == "fulfilled"
    assert points[SEED_IDS["student_a"]] == 900
    assert stocks[SEED_IDS["reward_voucher"]] == 2
    assert history == [("reward_redemption", -100)]


def test_two_batches_competing_for_last_item_fail_with_stable_business_error(
    postgres_test_url, seed_operating_catalog, api_client
):
    student_a = login_headers(api_client, "student.a@hyute.edu.vn")
    student_b = login_headers(api_client, "student.b@hyute.edu.vn")
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "update rewards set stock = 1 where id = %s",
            (SEED_IDS["reward_voucher"],),
        )
        connection.commit()
    batch_a = create_batch(api_client, student_a)
    batch_b = create_batch(api_client, student_b)

    def scan(batch, actor_id):
        try:
            with psycopg.connect(postgres_test_url) as connection:
                result = connection.execute(
                    "select scan_reward_redemption_batch(%s, %s)",
                    (batch["qrToken"], actor_id),
                ).fetchone()[0]
                connection.commit()
                return result["status"]
        except Exception as error:
            return str(error).strip().splitlines()[0]

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                lambda args: scan(*args),
                [
                    (batch_a, SEED_IDS["volunteer_a"]),
                    (batch_b, SEED_IDS["volunteer_b"]),
                ],
            )
        )

    assert sorted(results) == ["REWARD_OUT_OF_STOCK", "fulfilled"]
    with psycopg.connect(postgres_test_url) as connection:
        stocks = connection.execute(
            "select stock from rewards where id = %s",
            (SEED_IDS["reward_voucher"],),
        ).fetchone()[0]
        balances = connection.execute(
            "select sum(points) from users where id in (%s, %s)",
            (SEED_IDS["student_a"], SEED_IDS["student_b"]),
        ).fetchone()[0]
        statuses = [
            row[0]
            for row in connection.execute(
                "select status from reward_redemption_batches order by id"
            ).fetchall()
        ]
        history_count = connection.execute(
            "select count(*) from point_history where source = 'reward_redemption'"
        ).fetchone()[0]
    assert stocks == 0
    assert balances == 1700
    assert sorted(statuses) == ["fulfilled", "pending"]
    assert history_count == 1
