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


def configure_mission(database_url, event_type, target=1, reward_points=25):
    with psycopg.connect(database_url) as connection:
        connection.execute(
            """
            update missions
            set event_type = %s, filter_waste_type_id = null,
                target = %s, reward_points = %s
            where id = %s
            """,
            (event_type, target, reward_points, SEED_IDS["mission"]),
        )
        connection.commit()


def mission_state(database_url):
    with psycopg.connect(database_url) as connection:
        progress = connection.execute(
            """
            select current, completed, status
            from user_missions
            where user_id = %s and mission_id = %s
            """,
            (SEED_IDS["student_a"], SEED_IDS["mission"]),
        ).fetchone()
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
        reward_count = connection.execute(
            """
            select count(*) from point_history
            where user_id = %s and source = 'mission_reward'
            """,
            (SEED_IDS["student_a"],),
        ).fetchone()[0]
        event_count = connection.execute(
            """
            select count(*) from mission_events
            where user_id = %s and mission_id = %s
            """,
            (SEED_IDS["student_a"], SEED_IDS["mission"]),
        ).fetchone()[0]
    return progress, points, reward_count, event_count


def test_student_cannot_advance_mission_without_a_persisted_domain_event(
    postgres_test_url, seed_operating_catalog, api_client
):
    headers = login_headers(api_client, "student.a@hyute.edu.vn")

    responses = [
        api_client.post(
            f"/api/mobile/missions/{SEED_IDS['mission']}/advance",
            headers=headers,
            json={},
        )
        for _ in range(3)
    ]

    assert [response.status_code for response in responses] == [405, 405, 405]
    with psycopg.connect(postgres_test_url) as connection:
        progress_count = connection.execute(
            "select count(*) from user_missions"
        ).fetchone()[0]
        points = connection.execute(
            "select points from users where id = %s", (SEED_IDS["student_a"],)
        ).fetchone()[0]
    assert progress_count == 0
    assert points == 1000


def test_confirmed_submission_advances_mission_once_and_rewards_once(
    postgres_test_url, seed_operating_catalog, api_client
):
    configure_mission(postgres_test_url, "submission_confirmed")
    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")
    volunteer_headers = login_headers(api_client, "volunteer.a@hyute.edu.vn")
    created = api_client.post(
        "/api/mobile/recycling-submissions",
        headers=student_headers,
        json={
            "binId": SEED_IDS["bin_a"],
            "wasteTypeId": SEED_IDS["waste_plastic"],
            "quantity": 1,
        },
    ).json()["data"]
    scan = api_client.post(
        "/api/mobile/recycling-submissions/scan",
        headers=volunteer_headers,
        json={"qrToken": created["qrToken"], "stationId": SEED_IDS["bin_a"]},
    )
    assert scan.json()["data"]["result"] == "SUCCESS"
    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "insert into proof_images (submission_id, image_url) values (%s, '/proof.jpg')",
            (created["id"],),
        )
        connection.commit()

    confirmed = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer_headers,
        json={"actualQuantity": 1, "note": "Verified"},
    )
    replay = api_client.post(
        f"/api/mobile/recycling-submissions/{created['id']}/confirm",
        headers=volunteer_headers,
        json={"actualQuantity": 1, "note": "Replay"},
    )

    assert confirmed.status_code == 200
    assert replay.status_code == 400
    assert mission_state(postgres_test_url) == (
        (1, True, "completed"),
        1035,
        1,
        1,
    )


def test_feedback_event_is_idempotent_and_rewarded_by_backend(
    postgres_test_url, seed_operating_catalog, api_client
):
    configure_mission(postgres_test_url, "feedback_created")
    student_headers = login_headers(api_client, "student.a@hyute.edu.vn")

    response = api_client.post(
        "/api/mobile/feedback",
        headers=student_headers,
        json={"type": "other", "message": "Valid integration feedback"},
    )
    assert response.status_code == 201
    feedback_id = response.json()["data"]["id"]

    with psycopg.connect(postgres_test_url) as connection:
        connection.execute(
            "select apply_mission_event(%s, 'feedback_created', %s, null, 1)",
            (SEED_IDS["student_a"], feedback_id),
        )
        connection.commit()

    assert mission_state(postgres_test_url) == (
        (1, True, "completed"),
        1025,
        1,
        1,
    )


def test_concurrent_final_events_reward_a_mission_only_once(
    postgres_test_url, seed_operating_catalog
):
    configure_mission(postgres_test_url, "feedback_created")

    def apply_event(event_id):
        with psycopg.connect(postgres_test_url) as connection:
            result = connection.execute(
                "select apply_mission_event(%s, 'feedback_created', %s, null, 1)",
                (SEED_IDS["student_a"], event_id),
            ).fetchone()[0]
            connection.commit()
            return result

    with ThreadPoolExecutor(max_workers=2) as executor:
        processed = list(executor.map(apply_event, ["feedback-race-a", "feedback-race-b"]))

    assert processed == [1, 1]
    assert mission_state(postgres_test_url) == (
        (1, True, "completed"),
        1025,
        1,
        2,
    )
