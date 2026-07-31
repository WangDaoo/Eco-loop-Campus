from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tensorflow as tf
import numpy as np
from PIL import Image
import os
import requests
import h5py

app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str


# ---------------- ENV CHECK ----------------
IS_RENDER = os.getenv("RENDER") is not None


# ---------------- LOCAL AI FUNCTION ----------------
def ask_local_ai(message):

    # If deployed → disable local AI
    if IS_RENDER:
        return "Chatbot not available in deployed version"

    prompt = f"""
You are an AI Waste Management Assistant.

Help users with:
- recycling
- waste disposal
- environmental impact
- sustainability

Give very short precise helpful answers.

User question: {message}
"""

    try:
        r = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            },
            timeout=30
        )

        data = r.json()
        return data.get("response", "AI could not generate a response.")

    except Exception as e:
        return f"Local AI error: {str(e)}"


# ---------------- MODEL LOADING ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "mobilenetv2_model.h5")


def get_windows_short_path(path):
    if os.name != "nt":
        return path

    try:
        import ctypes
        from ctypes import wintypes

        buffer = ctypes.create_unicode_buffer(260)
        result = ctypes.windll.kernel32.GetShortPathNameW(path, buffer, 260)
        if result:
            return buffer.value
    except Exception:
        pass

    return path


def load_waste_model(path):
    safe_path = get_windows_short_path(path)

    try:
        return tf.keras.models.load_model(safe_path, compile=False)
    except Exception as primary_error:
        try:
            with h5py.File(safe_path, "r") as model_file:
                model_config = model_file.attrs.get("model_config")

            if model_config is None:
                raise ValueError("model_config missing from H5 file")

            reconstructed_model = tf.keras.models.model_from_json(model_config)
            reconstructed_model.load_weights(safe_path)
            print("[OK] Loaded model from config and weights fallback")
            return reconstructed_model
        except Exception as fallback_error:
            raise RuntimeError(
                f"load_model failed: {primary_error}; fallback failed: {fallback_error}"
            ) from fallback_error


try:
    model = load_waste_model(MODEL_PATH)
    print("[OK] Waste Classification Model Loaded")
except Exception as e:
    print("[ERROR] Model loading failed:", e)
    model = None


# Waste classes
classes = [
    "battery", "biological", "cardboard", "clothes",
    "glass", "metal", "paper", "plastic", "shoes", "trash"
]


# ---------------- DEFAULT ROUTE ----------------
@app.get("/")
def home():
    return {"message": "Smart Waste Detection Backend Running"}


# ---------------- PREDICTION ROUTE ----------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    if model is None:
        return {"error": "Model not loaded"}

    try:
        img = Image.open(file.file).convert("RGB")
        img = img.resize((224, 224))
        img = np.array(img) / 255.0
        img = np.expand_dims(img, axis=0)

        prediction = np.asarray(model.predict(img), dtype=float)
        scores = prediction.reshape(-1)
        if scores.size != len(classes):
            raise ValueError("Prediction failed: model output class count mismatch")
        if not np.isfinite(scores).all():
            raise ValueError("Prediction failed: model output contains invalid values")

        index = int(np.argmax(scores))
        confidence = float(np.max(scores))

        return {
            "class": classes[index],
            "confidence": round(confidence, 4)
        }

    except Exception as e:
        return {"error": f"Image processing failed: {str(e)}"}


# ---------------- AI CHATBOT ROUTE ----------------
@app.post("/chat")
async def chat(request: ChatRequest):

    try:
        reply = ask_local_ai(request.message)
        return {"reply": reply}

    except Exception as e:
        return {"reply": f"AI error: {str(e)}"}


# ---------------- LOCAL RUN ONLY ----------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
