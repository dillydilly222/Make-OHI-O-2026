import threading
import cv2
from ultralytics import YOLO
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = YOLO("yolov8n.pt")
stream_url = "http://192.168.4.1:81/stream"

people_count = 0
lock = threading.Lock()


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


if __name__ == "__main__":
    thread = threading.Thread(target=detection_loop, daemon=True)
    thread.start()
    app.run(host="0.0.0.0", port=5050)