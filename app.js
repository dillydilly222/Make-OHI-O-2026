const API_BASE = "https://content.osu.edu/v2/bus/routes/";

const cameraVideo = document.getElementById("camera-video");
const analysisCanvas = document.getElementById("analysis-canvas");
const cameraToggle = document.getElementById("camera-toggle");
const cameraStatus = document.getElementById("camera-status");
const activityScoreEl = document.getElementById("activity-score");
const occupancyLevelEl = document.getElementById("occupancy-level");
const boardingTipEl = document.getElementById("boarding-tip");

const routeSelect = document.getElementById("route-select");
const loadRouteBtn = document.getElementById("load-route");
const apiStatus = document.getElementById("api-status");
const stopsBody = document.getElementById("stops-body");
const stopCountEl = document.getElementById("stop-count");
const firstStopEl = document.getElementById("first-stop");
const lastUpdatedEl = document.getElementById("last-updated");

let mediaStream = null;
let analysisTimer = null;
let previousFrame = null;

function setOccupancyStatus(level, cssClass, tip) {
  occupancyLevelEl.className = `metric-value ${cssClass}`;
  occupancyLevelEl.textContent = level;
  boardingTipEl.textContent = tip;
}

function estimateOccupancy(score) {
  if (score < 6) {
    setOccupancyStatus("Light", "is-good", "Good time to board.");
  } else if (score < 13) {
    setOccupancyStatus("Moderate", "is-warn", "Board soon; room may tighten.");
  } else {
    setOccupancyStatus("Heavy", "is-bad", "Expect crowding and wait time.");
  }
}

function analyzeFrame() {
  if (!mediaStream || cameraVideo.readyState < 2) {
    return;
  }

  const context = analysisCanvas.getContext("2d", { willReadFrequently: true });
  const width = analysisCanvas.width;
  const height = analysisCanvas.height;
  context.drawImage(cameraVideo, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);

  if (!previousFrame) {
    previousFrame = new Uint8ClampedArray(data);
    return;
  }

  let diffTotal = 0;
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 16) {
    const currentLuma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const previousLuma =
      (previousFrame[i] + previousFrame[i + 1] + previousFrame[i + 2]) / 3;
    diffTotal += Math.abs(currentLuma - previousLuma);
    sampleCount += 1;
  }

  previousFrame = new Uint8ClampedArray(data);

  const normalized = sampleCount === 0 ? 0 : diffTotal / sampleCount;
  const score = Math.min(100, Math.round(normalized));
  activityScoreEl.textContent = `${score}/100`;
  estimateOccupancy(score);
}

async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    cameraVideo.srcObject = mediaStream;
    cameraStatus.textContent = "Camera active";
    cameraToggle.textContent = "Stop Camera";
    activityScoreEl.textContent = "0/100";
    previousFrame = null;

    analysisTimer = window.setInterval(analyzeFrame, 800);
  } catch (error) {
    cameraStatus.textContent = "Camera unavailable (permission/device issue)";
    occupancyLevelEl.textContent = "Unavailable";
    boardingTipEl.textContent = "Use route data while camera is offline.";
    console.error(error);
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (analysisTimer) {
    window.clearInterval(analysisTimer);
    analysisTimer = null;
  }
  previousFrame = null;
  cameraVideo.srcObject = null;
  cameraStatus.textContent = "Camera idle";
  cameraToggle.textContent = "Start Camera";
  activityScoreEl.textContent = "--";
  occupancyLevelEl.textContent = "--";
  occupancyLevelEl.className = "metric-value";
  boardingTipEl.textContent = "--";
}

cameraToggle.addEventListener("click", () => {
  if (mediaStream) {
    stopCamera();
  } else {
    startCamera();
  }
});

function renderStops(stops) {
  if (!stops.length) {
    stopsBody.innerHTML = '<tr><td colspan="5">No stops returned for this route.</td></tr>';
    return;
  }

  stopsBody.innerHTML = stops
    .map((stop, index) => {
      const name = stop.name || stop.stopName || "Unnamed stop";
      const id = stop.id || stop.stopId || "--";
      const lat = stop.latitude ?? stop.lat ?? "--";
      const lon = stop.longitude ?? stop.lon ?? "--";
      return `<tr>
        <td>${index + 1}</td>
        <td>${name}</td>
        <td>${id}</td>
        <td>${lat}</td>
        <td>${lon}</td>
      </tr>`;
    })
    .join("");
}

function resolveStops(payload) {
  if (Array.isArray(payload?.data?.route?.stops)) {
    return payload.data.route.stops;
  }
  if (Array.isArray(payload?.route?.stops)) {
    return payload.route.stops;
  }
  if (Array.isArray(payload?.stops)) {
    return payload.stops;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  return [];
}

async function loadRoute() {
  const code = routeSelect.value;
  apiStatus.textContent = `Loading ${code} route data...`;
  apiStatus.className = "status";

  try {
    const response = await fetch(`${API_BASE}${code}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const stops = resolveStops(payload);

    renderStops(stops);

    stopCountEl.textContent = String(stops.length);
    firstStopEl.textContent = stops[0]?.name || stops[0]?.stopName || "--";
    lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    apiStatus.textContent = `Loaded ${stops.length} stop(s) for ${code}.`;
    apiStatus.className = "status is-good";
  } catch (error) {
    console.error(error);
    stopsBody.innerHTML =
      '<tr><td colspan="5">Unable to fetch route data. Check network/CORS and endpoint availability.</td></tr>';
    stopCountEl.textContent = "--";
    firstStopEl.textContent = "--";
    lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    apiStatus.textContent = `Route fetch failed for ${code}.`;
    apiStatus.className = "status is-bad";
  }
}

loadRouteBtn.addEventListener("click", loadRoute);
window.addEventListener("beforeunload", stopCamera);

loadRoute();
