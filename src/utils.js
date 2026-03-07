import { ROUTE_API_BASE } from './constants';

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function demandLevel(score) {
  if (score < 35) return 'Light';
  if (score < 65) return 'Moderate';
  return 'Heavy';
}

export function formatForecast(value) {
  const rounded = Math.round(value);
  return `${demandLevel(rounded)} (${rounded}/100)`;
}

export function computeTrend(entries) {
  if (entries.length < 2) {
    return { trendLabel: 'Insufficient data', forecast15: null, forecast30: null };
  }
  const recent = entries.slice(-15);
  const n = recent.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const y = Number(recent[i].activityScore) || 0;
    sumX += i; sumY += y; sumXY += i * y; sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const last = Number(recent[n - 1].activityScore) || 0;
  const forecast15 = clamp(last + slope * 15, 0, 100);
  const forecast30 = clamp(last + slope * 30, 0, 100);
  let trendLabel = 'Steady';
  if (slope > 0.25) trendLabel = 'Rising';
  if (slope < -0.25) trendLabel = 'Falling';
  return { trendLabel, forecast15, forecast30 };
}

export function parseCoordinate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizeStop(stop) {
  const latitude = parseCoordinate(stop?.latitude) ?? parseCoordinate(stop?.lat);
  const longitude = parseCoordinate(stop?.longitude) ?? parseCoordinate(stop?.lon) ?? parseCoordinate(stop?.lng);
  return { ...stop, latitude, longitude, name: stop?.name || 'Unnamed Stop' };
}

export function decodePolyline(encoded) {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  while (index < encoded.length) {
    let result = 0, shift = 0, b;
    do { b = encoded.charCodeAt(index) - 63; index++; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = encoded.charCodeAt(index) - 63; index++; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

export function extractRouteData(payload) {
  const data = payload?.data || payload;
  const rawStops = Array.isArray(data?.stops) ? data.stops : Array.isArray(data?.route?.stops) ? data.route.stops : [];
  const rawPatterns = Array.isArray(data?.patterns) ? data.patterns : Array.isArray(data?.route?.patterns) ? data.route.patterns : [];
  const stops = rawStops.map(normalizeStop).filter(s => s.latitude !== null && s.longitude !== null);
  const patternLines = rawPatterns.map(p => decodePolyline(p.encodedPolyline || '')).filter(l => l.length > 1);
  return { stops, patternLines };
}

export async function fetchRoute(code) {
  const res = await fetch(`${ROUTE_API_BASE}${code}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return extractRouteData(await res.json());
}

export async function fetchVehicles(code) {
  try {
    const res = await fetch(`${ROUTE_API_BASE}${code}/vehicles`);
    if (!res.ok) return [];
    const payload = await res.json();
    const data = payload?.data || payload;
    return Array.isArray(data?.vehicles) ? data.vehicles : Array.isArray(data) ? data : [];
  } catch { return []; }
}
