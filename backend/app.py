import asyncio
import io
import time
import uuid

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tensorflow as tf
import numpy as np
from PIL import Image
import os
import requests
import h5py
from pathlib import Path

try:
    import psycopg
except Exception:
    psycopg = None

app = FastAPI()

AI_QUEUE_WORKERS = int(os.getenv("AI_QUEUE_WORKERS", "1"))
AI_QUEUE_MAX_SIZE = int(os.getenv("AI_QUEUE_MAX_SIZE", "50"))
AI_JOB_TTL_SECONDS = int(os.getenv("AI_JOB_TTL_SECONDS", "900"))

def create_ai_queue(max_size=AI_QUEUE_MAX_SIZE):
    return asyncio.Queue(maxsize=max_size)

ai_jobs = {}
ai_queue = create_ai_queue()
ai_worker_tasks = []


def parse_cors_origins(raw_origins):
    if not raw_origins or not raw_origins.strip():
        return ["*"]

    origins = [origin.strip() for origin in raw_origins.split(",")]
    return [origin for origin in origins if origin] or ["*"]

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(os.getenv("CORS_ORIGINS")),
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
PROJECT_DIR = Path(BASE_DIR).parent
RUNTIME_DATABASE_URL_PATH = PROJECT_DIR / ".runtime" / "DATABASE_URL.txt"


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

def cleanup_ai_jobs():
    cutoff = time.time() - AI_JOB_TTL_SECONDS
    expired = [job_id for job_id, job in ai_jobs.items() if job.get("updated_at", job.get("created_at", 0)) < cutoff]
    for job_id in expired:
        ai_jobs.pop(job_id, None)

def predict_image_bytes(image_bytes):
    if model is None:
        return {"error": "Model not loaded"}

    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img = img.resize((224, 224))
        img = np.array(img) / 255.0
        img = np.expand_dims(img, axis=0)

        prediction = np.asarray(model.predict(img), dtype=float)
        scores = prediction.reshape(-1)
        if scores.size != len(classes):
            raise ValueError("Prediction failed: model output class count mismatch")
        if not np.isfinite(scores).all():
            raise ValueError("Prediction failed: model output contains invalid values")
        if ((scores < 0) | (scores > 1)).any():
            raise ValueError("Prediction failed: model output confidence out of range")

        index = int(np.argmax(scores))
        confidence = float(np.max(scores))

        return {
            "class": classes[index],
            "confidence": round(confidence, 4)
        }

    except Exception as e:
        return {"error": f"Image processing failed: {str(e)}"}

async def ai_queue_worker():
    while True:
        job_id = await ai_queue.get()
        job = ai_jobs.get(job_id)
        if not job:
            ai_queue.task_done()
            continue
        job["status"] = "processing"
        job["updated_at"] = time.time()
        try:
            result = await asyncio.to_thread(predict_image_bytes, job["image_bytes"])
            if result.get("error"):
                job.update({"status": "failed", "error": result["error"]})
            else:
                job.update({"status": "done", "class": result["class"], "confidence": result["confidence"]})
        except Exception as e:
            job.update({"status": "failed", "error": f"Image processing failed: {str(e)}"})
        finally:
            job.pop("image_bytes", None)
            job["updated_at"] = time.time()
            ai_queue.task_done()

def ensure_ai_workers():
    global ai_worker_tasks
    running = [task for task in ai_worker_tasks if not task.done()]
    ai_worker_tasks = running
    missing = max(0, AI_QUEUE_WORKERS - len(running))
    for _ in range(missing):
        ai_worker_tasks.append(asyncio.create_task(ai_queue_worker()))

@app.on_event("startup")
async def start_ai_workers():
    ensure_ai_workers()


# ---------------- DEFAULT ROUTE ----------------
@app.get("/")
def home():
    return {"message": "Eco-loop Campus Backend Running"}


def get_database_url():
    configured = os.getenv("DATABASE_URL", "").strip()
    if configured:
        return configured
    if RUNTIME_DATABASE_URL_PATH.exists():
        return RUNTIME_DATABASE_URL_PATH.read_text(encoding="utf-8").strip()
    return ""


def check_database_health():
    database_url = get_database_url()
    if not database_url:
        return {"configured": False, "status": "missing"}
    if psycopg is None:
        return {"configured": True, "status": "missing_driver"}

    try:
        with psycopg.connect(database_url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("select current_database(), current_user")
                database, user = cursor.fetchone()
        return {
            "configured": True,
            "status": "ok",
            "database": database,
            "user": user,
        }
    except Exception as error:
        return {
            "configured": True,
            "status": "error",
            "error": str(error),
        }


@app.get("/db/health")
def db_health():
    return check_database_health()


# ---------------- PREDICTION ROUTE ----------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image_bytes = await file.read()
    return predict_image_bytes(image_bytes)

@app.post("/predict/jobs")
async def create_prediction_job(file: UploadFile = File(...)):
    cleanup_ai_jobs()
    ensure_ai_workers()
    if ai_queue.full():
        return JSONResponse(status_code=429, content={"error": "AI queue is full"})

    job_id = str(uuid.uuid4())
    now = time.time()
    ai_jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "image_bytes": await file.read(),
        "created_at": now,
        "updated_at": now,
    }
    position = ai_queue.qsize() + 1
    await ai_queue.put(job_id)
    return JSONResponse(status_code=202, content={
        "job_id": job_id,
        "status": "queued",
        "position": position,
        "poll_url": f"/predict/jobs/{job_id}",
    })

@app.get("/predict/jobs/{job_id}")
async def get_prediction_job(job_id: str):
    cleanup_ai_jobs()
    job = ai_jobs.get(job_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "AI job not found"})

    payload = {"job_id": job_id, "status": job["status"]}
    if job["status"] == "done":
        payload.update({"class": job["class"], "confidence": job["confidence"]})
    elif job["status"] == "failed":
        payload.update({"error": job.get("error", "AI processing failed")})
    return payload

@app.get("/predict/queue")
async def get_prediction_queue():
    cleanup_ai_jobs()
    counts = {"queued": 0, "processing": 0, "done": 0, "failed": 0}
    for job in ai_jobs.values():
        status = job.get("status")
        if status in counts:
            counts[status] += 1
    return {**counts, "max_size": AI_QUEUE_MAX_SIZE, "workers": AI_QUEUE_WORKERS}


# ---------------- AI CHATBOT ROUTE ----------------
@app.post("/chat")
async def chat(request: ChatRequest):

    message = request.message.strip()
    if not message:
        return {"reply": "Message is required"}

    try:
        reply = ask_local_ai(message)
        return {"reply": reply}

    except Exception as e:
        return {"reply": f"AI error: {str(e)}"}


# ---------------- LOCAL RUN ONLY ----------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
