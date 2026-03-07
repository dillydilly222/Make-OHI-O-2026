import threading
import requests
import cv2
from ultralytics import YOLO
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = YOLO("yolov8l.pt")
model.to("mps")
stream_url = "http://192.168.4.1:81/stream"

people_count = 0
lock = threading.Lock()

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.1"


def detection_loop():
    global people_count
    cap = cv2.VideoCapture(stream_url)
    while True:
        ret, frame = cap.read()
        if not ret:
            continue
        results = model(frame)
        count = sum(1 for r in results for box in r.boxes if int(box.cls) == 0)
        with lock:
            people_count = count


@app.route("/people-count")
def get_people_count():
    with lock:
        count = people_count
    return jsonify({"count": count})


@app.route("/recommendation", methods=["POST"])
def get_recommendation():
    data = request.get_json(force=True)
    count = data.get("count", 0)
    score = data.get("score", 0)
    level = data.get("level", "Unknown")

    prompt = (
        f"You are a transit advisor for Ohio State's CABS bus system. "
        f"A bus stop currently has {count} people waiting. "
        f"The crowd activity score is {score}/100 and the occupancy level is {level} "
        f"(Light = low crowd, Moderate = moderate crowd, Heavy = very crowded). "
        f"Respond with ONE concise sentence under 15 words advising a rider whether to board now or wait."
    )

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=15,
        )
        resp.raise_for_status()
        recommendation = resp.json().get("response", "").strip()
    except Exception:
        recommendation = None

    if recommendation:
        return jsonify({"recommendation": recommendation})
    return jsonify({"recommendation": None}), 503


if __name__ == "__main__":
    thread = threading.Thread(target=detection_loop, daemon=True)
    thread.start()
    app.run(host="0.0.0.0", port=5050)
