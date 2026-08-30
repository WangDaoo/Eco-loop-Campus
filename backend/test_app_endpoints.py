import io
from pathlib import Path
import tempfile
import time
import unittest

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

import app


class FakeWasteModel:
    def predict(self, image_batch):
        output = np.zeros((1, len(app.classes)))
        output[0, app.classes.index("plastic")] = 0.91
        return output

class NaNWasteModel:
    def predict(self, image_batch):
        output = np.zeros((1, len(app.classes)))
        output[0, app.classes.index("plastic")] = np.nan
        return output

class ShortWasteModel:
    def predict(self, image_batch):
        return np.array([[0.95]])



class OutOfRangeWasteModel:
    def predict(self, image_batch):
        output = np.zeros((1, len(app.classes)))
        output[0, app.classes.index("plastic")] = 1.4
        return output

def make_image_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), color=(20, 120, 80)).save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer

def post_prediction_job(client, content=None):
    return client.post(
        "/predict/jobs",
        files={"file": ("waste.jpg", content or make_image_bytes(), "image/jpeg")},
    )

def wait_for_job(client, job_id, expected_statuses=("done", "failed")):
    deadline = time.time() + 2
    payload = None
    while time.time() < deadline:
        response = client.get(f"/predict/jobs/{job_id}")
        payload = response.json()
        if payload.get("status") in expected_statuses:
            return response
        time.sleep(0.02)
    raise AssertionError(f"job {job_id} did not finish, last payload: {payload}")


class AppEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client_context = TestClient(app.app)
        self.client = self.client_context.__enter__()
        self.original_model = app.model
        self.original_ask_local_ai = app.ask_local_ai

    def tearDown(self):
        app.model = self.original_model
        app.ask_local_ai = self.original_ask_local_ai
        if hasattr(app, "ai_jobs"):
            app.ai_jobs.clear()
        if hasattr(app, "create_ai_queue"):
            app.ai_queue = app.create_ai_queue()
        self.client_context.__exit__(None, None, None)

    def test_health_endpoint(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Eco-loop Campus Backend Running"})

    def test_db_health_endpoint_reports_configured_database(self):
        original_check_database_health = app.check_database_health
        app.check_database_health = lambda: {
            "configured": True,
            "status": "ok",
            "database": "ecoloop_campus",
            "user": "ecoloop_app",
        }

        try:
            response = self.client.get("/db/health")
        finally:
            app.check_database_health = original_check_database_health

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "configured": True,
            "status": "ok",
            "database": "ecoloop_campus",
            "user": "ecoloop_app",
        })

    def test_api_db_health_alias_reports_configured_database(self):
        original_check_database_health = app.check_database_health
        app.check_database_health = lambda: {
            "configured": True,
            "status": "ok",
            "database": "ecoloop_campus",
            "user": "ecoloop_app",
        }

        try:
            response = self.client.get("/api/health/db")
        finally:
            app.check_database_health = original_check_database_health

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_avatar_presets_endpoint_lists_postgres_rows(self):
        original_list_avatar_presets = app.list_avatar_presets
        app.list_avatar_presets = lambda: [
            {"key": "leaf", "label": "Lá xanh", "imageUrl": "/uploads/avatars/leaf.png"}
        ]

        try:
            response = self.client.get("/api/avatar-presets")
        finally:
            app.list_avatar_presets = original_list_avatar_presets

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {"key": "leaf", "label": "Lá xanh", "imageUrl": "/uploads/avatars/leaf.png"}
        ])

    def test_avatar_presets_endpoint_uploads_image_and_saves_row(self):
        original_save_avatar_preset = app.save_avatar_preset
        captured = {}

        def fake_save_avatar_preset(key, label, file_name, content_type, content):
            captured.update({
                "key": key,
                "label": label,
                "file_name": file_name,
                "content_type": content_type,
                "content": content,
            })
            return {"key": key, "label": label, "imageUrl": "/uploads/avatars/eco.png"}

        app.save_avatar_preset = fake_save_avatar_preset

        try:
            response = self.client.post(
                "/api/avatar-presets",
                data={"key": "eco", "label": "Eco"},
                files={"file": ("eco.png", b"png-bytes", "image/png")},
            )
        finally:
            app.save_avatar_preset = original_save_avatar_preset

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"key": "eco", "label": "Eco", "imageUrl": "/uploads/avatars/eco.png"})
        self.assertEqual(captured["key"], "eco")
        self.assertEqual(captured["label"], "Eco")
        self.assertEqual(captured["file_name"], "eco.png")
        self.assertEqual(captured["content_type"], "image/png")
        self.assertEqual(captured["content"], b"png-bytes")

    def test_delete_avatar_preset_removes_database_row_and_uploaded_file(self):
        original_database_path = app.RUNTIME_DATABASE_URL_PATH
        original_connect = app.psycopg.connect
        original_avatar_dir = app.AVATAR_UPLOADS_DIR

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "avatars"
            image_path = root / "leaf" / "old.png"
            image_path.parent.mkdir(parents=True)
            image_path.write_bytes(b"avatar")
            app.AVATAR_UPLOADS_DIR = root
            app.RUNTIME_DATABASE_URL_PATH = Path(temp_dir) / "DATABASE_URL.txt"
            app.RUNTIME_DATABASE_URL_PATH.write_text("postgresql://test", encoding="utf-8")

            class FakeCursor:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    return False

                def execute(self, sql, params):
                    self.sql = sql
                    self.params = params

                def fetchone(self):
                    return ("leaf", "/uploads/avatars/leaf/old.png")

            class FakeConnection:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc, tb):
                    return False

                def cursor(self):
                    return FakeCursor()

                def commit(self):
                    self.committed = True

            app.psycopg.connect = lambda database_url: FakeConnection()

            try:
                response = app.delete_avatar_preset("leaf")
                file_exists_after_delete = image_path.exists()
            finally:
                app.psycopg.connect = original_connect
                app.RUNTIME_DATABASE_URL_PATH = original_database_path
                app.AVATAR_UPLOADS_DIR = original_avatar_dir

            self.assertEqual(response, {"ok": True})
            self.assertFalse(file_exists_after_delete)

    def test_parse_cors_origins_defaults_to_wildcard(self):
        self.assertEqual(app.parse_cors_origins(""), ["*"])
        self.assertEqual(app.parse_cors_origins(None), ["*"])

    def test_parse_cors_origins_splits_comma_separated_values(self):
        self.assertEqual(
            app.parse_cors_origins("https://admin.example.vn, http://localhost:3000"),
            ["https://admin.example.vn", "http://localhost:3000"],
        )

    def test_predict_returns_model_not_loaded_when_model_missing(self):
        app.model = None

        response = self.client.post(
            "/predict",
            files={"file": ("waste.jpg", make_image_bytes(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"error": "Model not loaded"})

    def test_predict_returns_class_and_confidence_for_valid_image(self):
        app.model = FakeWasteModel()

        response = self.client.post(
            "/predict",
            files={"file": ("waste.jpg", make_image_bytes(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"class": "plastic", "confidence": 0.91})

    def test_predict_jobs_accepts_image_and_completes(self):
        app.model = FakeWasteModel()

        response = post_prediction_job(self.client)

        self.assertEqual(response.status_code, 202)
        payload = response.json()
        self.assertEqual(payload["status"], "queued")
        self.assertEqual(payload["position"], 1)
        self.assertEqual(payload["poll_url"], f"/predict/jobs/{payload['job_id']}")

        result = wait_for_job(self.client, payload["job_id"])

        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json(), {
            "job_id": payload["job_id"],
            "status": "done",
            "class": "plastic",
            "confidence": 0.91,
        })

    def test_predict_job_not_found_returns_404(self):
        response = self.client.get("/predict/jobs/missing-job")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "AI job not found"})

    def test_predict_jobs_reports_failed_model_result(self):
        app.model = NaNWasteModel()

        response = post_prediction_job(self.client)
        payload = response.json()
        result = wait_for_job(self.client, payload["job_id"], expected_statuses=("failed",))

        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["status"], "failed")
        self.assertIn("Prediction failed", result.json()["error"])

    def test_predict_queue_health_reports_counts(self):
        app.ai_jobs["queued-job"] = {"status": "queued", "created_at": time.time(), "updated_at": time.time()}
        app.ai_jobs["processing-job"] = {"status": "processing", "created_at": time.time(), "updated_at": time.time()}
        app.ai_jobs["done-job"] = {"status": "done", "created_at": time.time(), "updated_at": time.time()}
        app.ai_jobs["failed-job"] = {"status": "failed", "created_at": time.time(), "updated_at": time.time()}

        response = self.client.get("/predict/queue")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["queued"], 1)
        self.assertEqual(response.json()["processing"], 1)
        self.assertEqual(response.json()["done"], 1)
        self.assertEqual(response.json()["failed"], 1)
        self.assertEqual(response.json()["max_size"], app.AI_QUEUE_MAX_SIZE)
        self.assertEqual(response.json()["workers"], app.AI_QUEUE_WORKERS)

    def test_predict_jobs_returns_429_when_queue_full(self):
        app.ai_queue = app.create_ai_queue(max_size=1)
        app.ai_queue.put_nowait("existing-job")

        response = post_prediction_job(self.client)

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json(), {"error": "AI queue is full"})

    def test_predict_returns_error_for_non_image_file(self):
        app.model = FakeWasteModel()

        response = self.client.post(
            "/predict",
            files={"file": ("bad.txt", b"not an image", "text/plain")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Image processing failed", response.json()["error"])

    def test_predict_returns_error_for_non_finite_model_output(self):
        app.model = NaNWasteModel()

        response = self.client.post(
            "/predict",
            files={"file": ("waste.jpg", make_image_bytes(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Prediction failed", response.json()["error"])

    def test_predict_returns_error_for_wrong_model_output_class_count(self):
        app.model = ShortWasteModel()

        response = self.client.post(
            "/predict",
            files={"file": ("waste.jpg", make_image_bytes(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Prediction failed", response.json()["error"])

    def test_predict_returns_error_for_out_of_range_model_output(self):
        app.model = OutOfRangeWasteModel()

        response = self.client.post(
            "/predict",
            files={"file": ("waste.jpg", make_image_bytes(), "image/jpeg")},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Prediction failed", response.json()["error"])

    def test_chat_rejects_blank_message_without_calling_local_ai(self):
        def fail_if_called(message):
            raise AssertionError("ask_local_ai should not be called for blank messages")

        app.ask_local_ai = fail_if_called

        response = self.client.post("/chat", json={"message": "   "})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reply": "Message is required"})

    def test_chat_returns_safe_reply(self):
        app.ask_local_ai = lambda message: f"reply: {message}"

        response = self.client.post("/chat", json={"message": "chai nhựa bỏ đâu"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reply": "reply: chai nhựa bỏ đâu"})


if __name__ == "__main__":
    unittest.main()
