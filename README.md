# Buckeye Bus Monitor

Frontend prototype for monitoring CABS bus stop activity with:
- Live camera stream + basic motion-based crowd estimate
- Route stop lookup from `https://content.osu.edu/v2/bus/routes/<LINE_CODE>`
- Summary cards for stop count, first stop, and update time

## Open in VSCode
Open folder:
`/Users/aprilcielica/Desktop/Software I/workspace/buckeye-bus-monitor`

## Run locally
Use any static server (recommended because some browsers block camera/fetch on `file://`).

Example:
```bash
cd "/Users/aprilcielica/Desktop/Software I/workspace/buckeye-bus-monitor"
python3 -m http.server 8000
```
Then open:
`http://localhost:8000`

## Notes
- Camera needs browser permission.
- If route fetch fails, it is usually endpoint availability or CORS from the browser.
