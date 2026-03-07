import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { ROUTE_PALETTE, VEHICLE_REFRESH_MS } from '../constants';
import { fetchRoute, fetchVehicles } from '../utils';

function addVehicleMarker(v, route, lg) {
  const lat = Number.parseFloat(v.latitude || v.lat);
  const lng = Number.parseFloat(v.longitude || v.lon || v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const heading = v.heading ?? 0;
  const icon = L.divIcon({
    className: 'vehicle-icon-wrap',
    html: `<div class="vehicle-icon" style="background:${route.color};transform:rotate(${heading}deg)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
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

export default function MapPanel({ routes, setRoutes, selectedRoute, setSelectedRoute }) {
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
  const [mapStatus, setMapStatus] = useState('Map idle.');
  const [mapStatusClass, setMapStatusClass] = useState('sampling-note');
  const [mapReady, setMapReady] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');

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
    setMapStatus(`Showing ${visibleCount} route(s).`);
    setMapStatusClass('sampling-note');
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
    setMapStatus('Loading map data...');
    setMapStatusClass('sampling-note');
    const results = await Promise.all(
      routes.map(async route => {
        try {
          routeCacheRef.current.set(route.code, await fetchRoute(route.code));
          return { ok: true };
        } catch {
          return { ok: false };
        }
      })
    );
    drawMap();
    await refreshVehicles();
    clearInterval(vehicleTimerRef.current);
    vehicleTimerRef.current = setInterval(refreshVehicles, VEHICLE_REFRESH_MS);
    const ok = results.filter(r => r.ok).length;
    if (ok === routes.length) {
      setMapStatus(`Loaded ${ok}/${routes.length} routes.`);
      setMapStatusClass('sampling-note is-good');
    } else {
      setMapStatus(`Loaded ${ok}/${routes.length} routes (some failed, likely CORS/network).`);
      setMapStatusClass('sampling-note is-warn');
    }
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

  const addRoute = () => {
    const code = customCode.trim().toUpperCase();
    const name = customName.trim();
    if (!code) { setMapStatus('Enter a route code to add.'); setMapStatusClass('sampling-note is-warn'); return; }
    if (routes.some(r => r.code === code)) { setMapStatus(`${code} already exists.`); setMapStatusClass('sampling-note is-warn'); return; }
    const color = ROUTE_PALETTE[routes.length % ROUTE_PALETTE.length];
    setRoutes(prev => [...prev, { code, name: name || `Custom Route ${code}`, color }]);
    setSelectedRoute(code);
    setCustomCode('');
    setCustomName('');
    setMapStatus(`Added route ${code}. Reload map data to fetch it.`);
    setMapStatusClass('sampling-note is-good');
  };

  return (
    <section className="panel map-panel">
      <h2>Route Context + Map</h2>
      <p className="lede">Set route context for demand tracking and show available routes on the map.</p>

      <div className="controls-simple">
        <label htmlFor="route-select">Route Context</label>
        <select id="route-select" value={selectedRoute} onChange={e => setSelectedRoute(e.target.value)}>
          {routes.map(r => (
            <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
          ))}
        </select>
      </div>

      <div className="controls-simple">
        <label htmlFor="custom-route-code">Add Route Code</label>
        <div className="route-add-row">
          <input
            id="custom-route-code"
            value={customCode}
            onChange={e => setCustomCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRoute()}
            type="text" placeholder="Code (e.g., WMC)" maxLength={10}
          />
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            type="text" placeholder="Name (optional)" maxLength={40}
          />
          <button className="btn" onClick={addRoute}>Add</button>
        </div>
      </div>

      <div className="map-controls">
        <button className="btn" onClick={reloadMapData}>Reload Map Data</button>
        <p className={mapStatusClass}>{mapStatus}</p>
      </div>

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
