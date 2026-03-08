import threading
import requests
import cv2
from ultralytics import YOLO
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = YOLO("yolov8x.pt")
model.to("mps")
stream_url = "http://192.168.137.90:81/stream"

people_count = 0
lock = threading.Lock()

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.1:8b"


def detection_loop():
    global people_count
    while True:
        cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
        while True:
            ret, frame = cap.read()
            if not ret:
                cap.release()
                break
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
    level = data.get("level", "Unknown")
    weather = data.get("weather", None)

    weather_str = ""
    if weather:
        temp = weather.get("temperature")
        condition = weather.get("weatherCode")
        weather_str = f", {round(temp)}F weather code {condition}"

    prompt = (
        f"{count} people at stop, crowd={level}{weather_str}. "
        f"3-4 words only: board or wait? No explanation."
    )

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False, "options": {"num_predict": 8, "temperature": 0}},
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
