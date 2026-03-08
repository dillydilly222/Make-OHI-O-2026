import { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_ROUTES, WEATHER_REFRESH_MS } from './constants';
import { fetchWeather } from './utils';
import { useDemandHistory } from './hooks/useDemandHistory';
import CameraPanel from './components/CameraPanel';
import MapPanel from './components/MapPanel';

export default function App() {
  const [routes] = useState(INITIAL_ROUTES);
  const [selectedRoute] = useState('BE');
  const { addSample } = useDemandHistory();
  const [weather, setWeather] = useState(null);
  const weatherTimerRef = useRef(null);

  const loadWeather = useCallback(async () => {
    try {
      setWeather(await fetchWeather());
    } catch { /* silently ignore weather failures */ }
  }, []);

  useEffect(() => {
    loadWeather();
    weatherTimerRef.current = setInterval(loadWeather, WEATHER_REFRESH_MS);
    return () => clearInterval(weatherTimerRef.current);
  }, [loadWeather]);

  return (
    <>
      <div className="bg-grid" aria-hidden="true" />
      <header className="hero">
        <p className="eyebrow">Ohio State CABS Toolkit</p>
        <h1>Buckeye Bus Demand Monitor</h1>
        <p className="lede">Live people count from the ESP32 camera, demand forecasting, and active CABS routes on a map.</p>
      </header>

      <main className="layout">
        <CameraPanel
          selectedRoute={selectedRoute}
          addSample={addSample}
          weather={weather}
        />
        <MapPanel
          routes={routes}
        />
      </main>

      <footer>
        <p>ESP camera server: <code>detect.py</code> &nbsp;&middot;&nbsp; LLM: Ollama <code>llama3.1</code> &nbsp;&middot;&nbsp; Route API: <code>https://content.osu.edu/v2/bus/routes/&lt;CODE&gt;</code></p>
      </footer>
    </>
  );
}
