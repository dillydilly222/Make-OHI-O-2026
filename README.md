# Buckeye Bus Demand Monitor

Full-stack React + Python prototype for monitoring bus stop demand at Ohio State CABS stops.

## Features

### Frontend (React + Vite)
- **Live camera stream** with pixel-difference crowd activity estimation
- **YOLO integration** — polls `detect.py` server at `localhost:5050` for real people count; toggle between Pixel-Diff and YOLO modes via source tabs
- **Demand snapshots** saved once per minute while camera is active (localStorage)
- **Per-route demand forecasting** (+15m and +30m via linear regression)
- **Sparkline chart** of recent demand samples
- **Demand history table** (last 12 samples for selected route)
- **Leaflet map** (CARTO Voyager basemap) with:
  - Route polylines and stop markers per CABS route
  - Live vehicle position markers with heading arrows, refreshed every 15 seconds
  - Route visibility toggles
  - Reload map data button
- **Add custom route codes** from UI for quick troubleshooting

### Backend (Python)
- `detect.py` — Flask server + YOLOv8 detection loop reading from ESP32 camera stream (`http://192.168.4.1:81/stream`), exposes `/people-count` on port 5050
- `main.py` — Standalone script for quick local testing of YOLO detection

## Setup

### Frontend
```bash
npm install
npm run dev
```
Open `http://localhost:5173`

### Python backend
```bash
pip install ultralytics flask flask-cors opencv-python
python detect.py
```
Make sure your ESP32-CAM is on the network at `192.168.4.1`.

## Notes
- Camera permission is required for pixel-diff activity tracking.
- Demand history is stored in `localStorage` under `buckeye-bus-demand-history-v1`.
- YOLO server runs independently; the frontend silently skips it if offline.
- If map loading partially fails it is usually CORS/network on specific route API calls.
- Vehicle positions may return empty if the OSU API doesn't expose that endpoint publicly.