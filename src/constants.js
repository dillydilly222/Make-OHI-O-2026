export const DEMAND_STORAGE_KEY = 'buckeye-bus-demand-history-v1';
export const SAMPLE_INTERVAL_MS = 60 * 1000;
export const ANALYSIS_INTERVAL_MS = 2000;
export const ROUTE_API_BASE = 'https://content.osu.edu/v2/bus/routes/';
export const YOLO_SERVER = 'http://localhost:5050/people-count';
export const YOLO_POLL_MS = 7000;
export const VEHICLE_REFRESH_MS = 15000;
export const WEATHER_REFRESH_MS = 15 * 60 * 1000;
export const COLUMBUS_LAT = 39.9612;
export const COLUMBUS_LON = -82.9988;
export const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${39.9612}&longitude=${-82.9988}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;

export const INITIAL_ROUTES = [
  { code: 'BE', name: 'Buckeye Express', color: '#1f6feb' },
  { code: 'CC', name: 'Campus Connector', color: '#8f3fb4' },
  { code: 'CLS', name: 'Campus Loop South', color: '#e67e22' },
  { code: 'ER', name: 'East Residential', color: '#0f8b8d' },
  { code: 'MC', name: 'Medical Center', color: '#c82127' },
  { code: 'NWC', name: 'Northwest Connector', color: '#4f7d2a' },
  { code: 'WMC', name: 'Wexner Medical Center Shuttle', color: '#c75d1f' },
];

export const ROUTE_PALETTE = ['#9b2226', '#6d597a', '#227c9d', '#2a9d8f', '#3a5a40', '#8f2d56'];
