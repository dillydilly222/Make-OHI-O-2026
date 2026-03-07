import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { VEHICLE_REFRESH_MS } from '../constants';
import { fetchRoute, fetchVehicles } from '../utils';

function addVehicleMarker(v, route, lg) {
  const lat = Number.parseFloat(v.latitude || v.lat);
  const lng = Number.parseFloat(v.longitude || v.lon || v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const heading = v.heading ?? 0;
  const icon = L.divIcon({
    className: 'vehicle-icon-wrap',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="24" viewBox="0 0 18 24"
        style="transform:rotate(${heading}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.45))">
      <!-- front point -->
      <polygon points="9,0 17,7 1,7" fill="${route.color}" stroke="white" stroke-width="1.2"/>
      <!-- body -->
      <rect x="1" y="6" width="16" height="16" rx="2" fill="${route.color}" stroke="white" stroke-width="1.2"/>
      <!-- windows -->
      <rect x="3" y="9"  width="5" height="4" rx="1" fill="rgba(255,255,255,0.75)"/>
      <rect x="10" y="9" width="5" height="4" rx="1" fill="rgba(255,255,255,0.75)"/>
      <rect x="3" y="15" width="5" height="4" rx="1" fill="rgba(255,255,255,0.75)"/>
      <rect x="10" y="15" width="5" height="4" rx="1" fill="rgba(255,255,255,0.75)"/>
    </svg>`,
    iconSize: [18, 24],
    iconAnchor: [9, 12],
  });
  L.marker([lat, lng], { icon })
    .bindPopup(
      `<strong>Route ${route.code}</strong><br/>` +
      `Speed: ${v.speed ?? '?'} mph<br/>` +
      `Heading: ${heading}&deg;<br/>` +
      `Status: ${v.status ?? 'unknown'}`
    )
    .addTo(lg);
}

export default function MapPanel({ routes }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeCacheRef = useRef(new Map());
  const routeLayerGroupsRef = useRef(new Map());
  const vehicleLayerGroupsRef = useRef(new Map());
  const vehicleTimerRef = useRef(null);

  const [routeVisibility, setRouteVisibility] = useState(() => {
    const m = new Map();
    routes.forEach(r => m.set(r.code, true));
    return m;
  });
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map once
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, preferCanvas: true }).setView([39.999, -83.014], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);
  }, []);

  // Sync visibility map when new routes are added
  useEffect(() => {
    setRouteVisibility(prev => {
      const next = new Map(prev);
      let changed = false;
      routes.forEach(r => {
        if (!next.has(r.code)) { next.set(r.code, true); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [routes]);

  const drawMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    routeLayerGroupsRef.current.forEach(layer => map.removeLayer(layer));
    routeLayerGroupsRef.current.clear();

    const bounds = [];
    let visibleCount = 0;

    routes.forEach(route => {
      if (!routeVisibility.get(route.code)) return;
      const data = routeCacheRef.current.get(route.code);
      if (!data) return;

      visibleCount++;
      const layerGroup = L.layerGroup();
      data.patternLines.forEach(line => {
        L.polyline(line, { color: route.color, weight: 3, opacity: 0.9 }).addTo(layerGroup);
        line.forEach(pt => bounds.push(pt));
      });
      data.stops.forEach(stop => {
        const pt = [stop.latitude, stop.longitude];
        L.circleMarker(pt, { radius: 5, color: route.color, fillColor: route.color, fillOpacity: 0.8, weight: 1 })
          .bindPopup(`<strong>${stop.name}</strong><br/>Route: ${route.code}<br/>Stop ID: ${stop.id || 'n/a'}`)
          .addTo(layerGroup);
        bounds.push(pt);
      });
      layerGroup.addTo(map);
      routeLayerGroupsRef.current.set(route.code, layerGroup);
    });

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
  }, [routes, routeVisibility]);

  const refreshVehicles = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    vehicleLayerGroupsRef.current.forEach(lg => map.removeLayer(lg));
    vehicleLayerGroupsRef.current.clear();

    for (const route of routes) {
      if (!routeVisibility.get(route.code)) continue;
      const vehicles = await fetchVehicles(route.code);
      if (!vehicles.length) continue;
      const lg = L.layerGroup();
      vehicles.forEach(v => addVehicleMarker(v, route, lg));
      lg.addTo(map);
      vehicleLayerGroupsRef.current.set(route.code, lg);
    }
  }, [routes, routeVisibility]);

  const reloadMapData = useCallback(async () => {
    await Promise.all(
      routes.map(async route => {
        try {
          routeCacheRef.current.set(route.code, await fetchRoute(route.code));
        } catch { /* silently skip failed routes */ }
      })
    );
    drawMap();
    await refreshVehicles();
    clearInterval(vehicleTimerRef.current);
    vehicleTimerRef.current = setInterval(refreshVehicles, VEHICLE_REFRESH_MS);
  }, [routes, drawMap, refreshVehicles]);

  // Initial data load after map is ready
  useEffect(() => {
    if (!mapReady) return;
    reloadMapData();
  }, [mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redraw when visibility changes
  useEffect(() => {
    if (!mapReady) return;
    drawMap();
  }, [routeVisibility, drawMap, mapReady]);

  // Cleanup vehicle timer on unmount
  useEffect(() => () => clearInterval(vehicleTimerRef.current), []);

  return (
    <section className="panel map-panel">
      <div className="map-toolbar">
        <p className="metric-label">Map Visibility</p>
        <div className="route-toggles">
          {routes.map(route => (
            <button
              key={route.code}
              className={`route-toggle ${routeVisibility.get(route.code) ? '' : 'inactive'}`}
              onClick={() => setRouteVisibility(prev => new Map(prev).set(route.code, !prev.get(route.code)))}
            >
              <span className="route-dot" style={{ background: route.color }} />
              <span>{route.code}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={mapRef} className="route-map" aria-label="Map of CABS routes" />
    </section>
  );
}
