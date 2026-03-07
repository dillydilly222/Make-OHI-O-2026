# Buckeye Bus Demand Monitor

Frontend prototype for monitoring stop demand with:
- Live camera stream for activity estimation
- Demand snapshots saved once per minute while camera is active
- Per-route demand forecasting (+15m and +30m)
- Leaflet map with route visibility toggles and route reload
- Map rendering from API responses with `data.stops` and `data.patterns` (encoded polylines)
- Add custom route codes directly from the UI for quick troubleshooting

## Open in VSCode
Open folder:
`/Users/aprilcielica/Desktop/Software I/workspace/buckeye-bus-monitor`

## Run locally
Use any static server.

Example:
```bash
cd "/Users/aprilcielica/Desktop/Software I/workspace/buckeye-bus-monitor"
python3 -m http.server 8000
```
Then open:
`http://localhost:8000`

## Notes
- Camera permission is required for activity tracking.
- Demand history is stored in browser localStorage under `buckeye-bus-demand-history-v1`.
- If map loading partially fails, it is usually CORS/network permissions on specific route calls.
