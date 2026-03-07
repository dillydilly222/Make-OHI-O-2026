const DEMAND_STORAGE_KEY = "buckeye-bus-demand-history-v1";
const SAMPLE_INTERVAL_MS = 60 * 1000;
const ANALYSIS_INTERVAL_MS = 2000;
const ROUTE_API_BASE = "https://content.osu.edu/v2/bus/routes/";

const ROUTES = [
  { code: "BE", name: "Buckeye Express", color: "#1f6feb" },
  { code: "CC", name: "Campus Connector", color: "#8f3fb4" },
  { code: "CLS", name: "Campus Loop South", color: "#e67e22" },
  { code: "ER", name: "East Residential", color: "#0f8b8d" },
  { code: "MC", name: "Medical Center", color: "#c82127" },
  { code: "NWC", name: "Northwest Connector", color: "#4f7d2a" },
  { code: "WMC", name: "Wexner Medical Center Shuttle", color: "#c75d1f" },
];

const cameraVideo = document.getElementById("camera-video");
const analysisCanvas = document.getElementById("analysis-canvas");
const cameraToggle = document.getElementById("camera-toggle");
const cameraStatus = document.getElementById("camera-status");
const activityScoreEl = document.getElementById("activity-score");
const occupancyLevelEl = document.getElementById("occupancy-level");
const boardingTipEl = document.getElementById("boarding-tip");
const sampleCountEl = document.getElementById("sample-count");
const forecast15El = document.getElementById("forecast-15");
const forecast30El = document.getElementById("forecast-30");
const trendDirectionEl = document.getElementById("trend-direction");
const demandHistoryBody = document.getElementById("demand-history-body");
const demandSparkline = document.getElementById("demand-sparkline");

const routeSelect = document.getElementById("route-select");
const customRouteCodeInput = document.getElementById("custom-route-code");
const customRouteNameInput = document.getElementById("custom-route-name");
const addRouteBtn = document.getElementById("add-route-btn");
const reloadMapBtn = document.getElementById("reload-map-btn");
const mapStatus = document.getElementById("map-status");
const routeTogglesEl = document.getElementById("route-toggles");

const routeCache = new Map();
const routeLayerGroups = new Map();
const routeVisibility = new Map();

let mediaStream = null;
let analysisTimer = null;
let samplingTimer = null;
let previousFrame = null;
let currentActivityScore = 0;
let demandHistory = loadDemandHistory();
let map;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseCoordinate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function routeName(code) {
  const route = ROUTES.find((item) => item.code === code);
  return route ? route.name : code;
}

function routeColor(code) {
  const route = ROUTES.find((item) => item.code === code);
  return route ? route.color : "#4b5563";
}

function renderRouteOptions() {
  const selected = routeSelect.value || "BE";
  routeSelect.innerHTML = ROUTES.map((route) => {
    return `<option value="${route.code}">${route.name} (${route.code})</option>`;
  }).join("");
  routeSelect.value = ROUTES.some((route) => route.code === selected) ? selected : ROUTES[0].code;
}

function createRouteToggles() {
  routeTogglesEl.innerHTML = ROUTES.map((route) => {
    if (!routeVisibility.has(route.code)) {
      routeVisibility.set(route.code, true);
    }
    const checked = routeVisibility.get(route.code) ? "checked" : "";
    return `<label class="route-toggle">
      <span class="route-dot" style="background:${route.color};"></span>
      <input type="checkbox" data-route-code="${route.code}" ${checked} />
      <span>${route.code}</span>
    </label>`;
  }).join("");

  routeTogglesEl.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", (event) => {
      const code = event.target.getAttribute("data-route-code");
      routeVisibility.set(code, event.target.checked);
      drawMap();
    });
  });
}

function demandLevel(score) {
  if (score < 35) {
    return "Light";
  }
  if (score < 65) {
    return "Moderate";
  }
  return "Heavy";
}

function setOccupancyStatus(score) {
  const level = demandLevel(score);
  if (level === "Light") {
    occupancyLevelEl.className = "metric-value is-good";
    occupancyLevelEl.textContent = "Light";
    boardingTipEl.textContent = "Good time to board.";
  } else if (level === "Moderate") {
    occupancyLevelEl.className = "metric-value is-warn";
    occupancyLevelEl.textContent = "Moderate";
    boardingTipEl.textContent = "Board soon; volume is rising.";
  } else {
    occupancyLevelEl.className = "metric-value is-bad";
    occupancyLevelEl.textContent = "Heavy";
    boardingTipEl.textContent = "Expect crowding and possible delay.";
  }
}

function loadDemandHistory() {
  try {
    const raw = localStorage.getItem(DEMAND_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDemandHistory() {
  localStorage.setItem(DEMAND_STORAGE_KEY, JSON.stringify(demandHistory));
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
  currentActivityScore = clamp(Math.round(normalized * 1.8), 0, 100);

  activityScoreEl.textContent = `${currentActivityScore}/100`;
  setOccupancyStatus(currentActivityScore);
}

function computeTrend(entries) {
  if (entries.length < 2) {
    return { trendLabel: "Insufficient data", forecast15: null, forecast30: null };
  }

  const recent = entries.slice(-15);
  const n = recent.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = Number(recent[i].activityScore) || 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const last = Number(recent[n - 1].activityScore) || 0;

  const forecast15 = clamp(last + slope * 15, 0, 100);
  const forecast30 = clamp(last + slope * 30, 0, 100);

  let trendLabel = "Steady";
  if (slope > 0.25) {
    trendLabel = "Rising";
  }
  if (slope < -0.25) {
    trendLabel = "Falling";
  }

  return { trendLabel, forecast15, forecast30 };
}

function drawSparkline(entries) {
  const context = demandSparkline.getContext("2d");
  const width = demandSparkline.width;
  const height = demandSparkline.height;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#e6e2da";
  context.lineWidth = 1;
  for (let i = 1; i <= 4; i += 1) {
    const y = (height / 5) * i;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  if (!entries.length) {
    context.fillStyle = "#6b7280";
    context.font = "12px Archivo";
    context.fillText("No demand samples yet", 12, 20);
    return;
  }

  const data = entries.slice(-40);
  const xStep = data.length <= 1 ? width : width / (data.length - 1);
  context.beginPath();
  context.lineWidth = 2;
  context.strokeStyle = "#c82127";

  data.forEach((entry, index) => {
    const x = index * xStep;
    const y = height - (clamp(Number(entry.activityScore) || 0, 0, 100) / 100) * height;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();
}

function renderDemandHistory(entries) {
  const recent = entries.slice(-12).reverse();
  if (!recent.length) {
    demandHistoryBody.innerHTML = '<tr><td colspan="4">No demand samples yet.</td></tr>';
    return;
  }

  demandHistoryBody.innerHTML = recent
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `<tr>
        <td>${time}</td>
        <td>${entry.routeCode}</td>
        <td>${entry.activityScore}/100</td>
        <td>${entry.level}</td>
      </tr>`;
    })
    .join("");
}

function formatForecast(value) {
  const rounded = Math.round(value);
  return `${demandLevel(rounded)} (${rounded}/100)`;
}

function routeEntries(routeCode) {
  return demandHistory.filter((entry) => entry.routeCode === routeCode);
}

function normalizeStop(stop) {
  const latitude = parseCoordinate(stop?.latitude) ?? parseCoordinate(stop?.lat);
  const longitude = parseCoordinate(stop?.longitude) ?? parseCoordinate(stop?.lon) ?? parseCoordinate(stop?.lng);
  return {
    ...stop,
    latitude,
    longitude,
    name: stop?.name || "Unnamed Stop",
  };
}

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

function extractRouteData(payload) {
  const data = payload?.data || payload;
  const rawStops = Array.isArray(data?.stops)
    ? data.stops
    : Array.isArray(data?.route?.stops)
      ? data.route.stops
      : [];

  const rawPatterns = Array.isArray(data?.patterns)
    ? data.patterns
    : Array.isArray(data?.route?.patterns)
      ? data.route.patterns
      : [];

  const stops = rawStops.map(normalizeStop).filter((stop) => stop.latitude !== null && stop.longitude !== null);
  const patternLines = rawPatterns
    .map((pattern) => decodePolyline(pattern.encodedPolyline || ""))
    .filter((line) => line.length > 1);

  return {
    stops,
    patternLines,
    status: payload?.status || "unknown",
    lastModified: payload?.lastModified || null,
  };
}

async function fetchRoute(code) {
  const response = await fetch(`${ROUTE_API_BASE}${code}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  return extractRouteData(payload);
}

function initializeMap() {
  map = L.map("route-map", {
    zoomControl: true,
    preferCanvas: true,
  }).setView([39.999, -83.014], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

function clearMapLayers() {
  routeLayerGroups.forEach((layer) => {
    map.removeLayer(layer);
  });
  routeLayerGroups.clear();
}

function buildPopup(routeCode, stop) {
  return `<strong>${stop.name}</strong><br/>Route: ${routeCode}<br/>Stop ID: ${stop.id || "n/a"}`;
}

function drawMap() {
  clearMapLayers();

  const bounds = [];
  let visibleRoutes = 0;

  ROUTES.forEach((route) => {
    if (!routeVisibility.get(route.code)) {
      return;
    }

    const data = routeCache.get(route.code);
    if (!data) {
      return;
    }

    visibleRoutes += 1;
    const layerGroup = L.layerGroup();

    data.patternLines.forEach((line) => {
      L.polyline(line, {
        color: route.color,
        weight: 3,
        opacity: 0.9,
      }).addTo(layerGroup);
      line.forEach((point) => bounds.push(point));
    });

    data.stops.forEach((stop) => {
      const point = [stop.latitude, stop.longitude];
      L.circleMarker(point, {
        radius: 5,
        color: route.color,
        fillColor: route.color,
        fillOpacity: 0.8,
        weight: 1,
      }).bindPopup(buildPopup(route.code, stop)).addTo(layerGroup);
      bounds.push(point);
    });

    layerGroup.addTo(map);
    routeLayerGroups.set(route.code, layerGroup);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }

  mapStatus.textContent = `Showing ${visibleRoutes} route(s).`;
}

async function reloadMapData() {
  mapStatus.textContent = "Loading map data...";
  mapStatus.className = "sampling-note";

  const results = await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const data = await fetchRoute(route.code);
        routeCache.set(route.code, data);
        return { code: route.code, ok: true };
      } catch (error) {
        return { code: route.code, ok: false, error };
      }
    })
  );

  drawMap();

  const ok = results.filter((item) => item.ok).length;
  if (ok === ROUTES.length) {
    mapStatus.textContent = `Loaded ${ok}/${ROUTES.length} routes.`;
    mapStatus.className = "sampling-note is-good";
  } else {
    mapStatus.textContent = `Loaded ${ok}/${ROUTES.length} routes (some failed, likely CORS/network).`;
    mapStatus.className = "sampling-note is-warn";
  }
}

function addRouteFromInputs() {
  const code = customRouteCodeInput.value.trim().toUpperCase();
  const name = customRouteNameInput.value.trim();

  if (!code) {
    mapStatus.textContent = "Enter a route code to add.";
    mapStatus.className = "sampling-note is-warn";
    return;
  }

  if (ROUTES.some((route) => route.code === code)) {
    mapStatus.textContent = `${code} already exists.`;
    mapStatus.className = "sampling-note is-warn";
    return;
  }

  const palette = ["#9b2226", "#6d597a", "#227c9d", "#2a9d8f", "#3a5a40", "#8f2d56"];
  const color = palette[ROUTES.length % palette.length];
  ROUTES.push({ code, name: name || `Custom Route ${code}`, color });
  routeVisibility.set(code, true);

  renderRouteOptions();
  createRouteToggles();
  routeSelect.value = code;
  updateDemandAnalytics();

  customRouteCodeInput.value = "";
  customRouteNameInput.value = "";
  mapStatus.textContent = `Added route ${code}. Reload map data to fetch it.`;
  mapStatus.className = "sampling-note is-good";
}

function updateDemandAnalytics() {
  const entries = routeEntries(routeSelect.value);
  sampleCountEl.textContent = String(entries.length);

  const trend = computeTrend(entries);
  if (trend.forecast15 === null) {
    forecast15El.textContent = "--";
    forecast30El.textContent = "--";
    trendDirectionEl.textContent = "Insufficient data";
  } else {
    forecast15El.textContent = formatForecast(trend.forecast15);
    forecast30El.textContent = formatForecast(trend.forecast30);
    trendDirectionEl.textContent = trend.trendLabel;
  }

  renderDemandHistory(entries);
  drawSparkline(entries);
}

function recordDemandSample() {
  if (!mediaStream) {
    return;
  }

  demandHistory.push({
    timestamp: Date.now(),
    routeCode: routeSelect.value,
    activityScore: currentActivityScore,
    level: demandLevel(currentActivityScore),
  });

  if (demandHistory.length > 1440) {
    demandHistory = demandHistory.slice(-1440);
  }

  saveDemandHistory();
  updateDemandAnalytics();
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
    cameraStatus.textContent = "Camera active | sampling every minute";
    cameraToggle.textContent = "Stop Camera";
    previousFrame = null;

    if (analysisTimer) {
      window.clearInterval(analysisTimer);
    }
    analysisTimer = window.setInterval(analyzeFrame, ANALYSIS_INTERVAL_MS);

    if (samplingTimer) {
      window.clearInterval(samplingTimer);
    }
    samplingTimer = window.setInterval(recordDemandSample, SAMPLE_INTERVAL_MS);

    setTimeout(() => {
      analyzeFrame();
      recordDemandSample();
    }, 3000);
  } catch (error) {
    cameraStatus.textContent = "Camera unavailable (permission/device issue)";
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
  if (samplingTimer) {
    window.clearInterval(samplingTimer);
    samplingTimer = null;
  }

  previousFrame = null;
  cameraVideo.srcObject = null;
  cameraStatus.textContent = "Camera idle";
  cameraToggle.textContent = "Start Camera";
}

cameraToggle.addEventListener("click", () => {
  if (mediaStream) {
    stopCamera();
  } else {
    startCamera();
  }
});

routeSelect.addEventListener("change", updateDemandAnalytics);
addRouteBtn.addEventListener("click", addRouteFromInputs);
customRouteCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addRouteFromInputs();
  }
});
reloadMapBtn.addEventListener("click", reloadMapData);
window.addEventListener("beforeunload", stopCamera);

ROUTES.forEach((route) => routeVisibility.set(route.code, true));
renderRouteOptions();
createRouteToggles();
initializeMap();
updateDemandAnalytics();
reloadMapData();
