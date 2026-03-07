import cv2
from ultralytics import YOLO

# Load YOLO model
model = YOLO("yolov8n.pt")

# Connect to ESP32 stream
stream_url = "http://192.168.4.1:81/stream"
cap = cv2.VideoCapture(stream_url)

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    # Run YOLO detection
    results = model(frame)

    # Count people (class 0 = person in YOLO)
    people_count = sum(1 for r in results for box in r.boxes if int(box.cls) == 0)
    print("People waiting:", people_count)

    # Show the frame
    cv2.imshow("Bus Stop Camera", frame)

    if cv2.waitKey(1) & 0xFF == 27:  # Press Esc to quit
        break

cap.release()
cv2.destroyAllWindows()