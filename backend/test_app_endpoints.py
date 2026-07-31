import io
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


def make_image_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), color=(20, 120, 80)).save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


class AppEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app.app)
        self.original_model = app.model
        self.original_ask_local_ai = app.ask_local_ai

    def tearDown(self):
        app.model = self.original_model
        app.ask_local_ai = self.original_ask_local_ai

    def test_health_endpoint(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Smart Waste Detection Backend Running"})

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
    def test_chat_returns_safe_reply(self):
        app.ask_local_ai = lambda message: f"reply: {message}"

        response = self.client.post("/chat", json={"message": "chai nhựa bỏ đâu"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"reply": "reply: chai nhựa bỏ đâu"})


if __name__ == "__main__":
    unittest.main()
