import { useState, useEffect, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useYoloFeed } from '../hooks/useYoloFeed';
import { SAMPLE_INTERVAL_MS } from '../constants';
import { demandLevel, formatForecast, computeTrend } from '../utils';
import Sparkline from './Sparkline';

function peopleToScore(count) {
  return Math.min(Math.round((count / 20) * 100), 100);
}

function occupancyClass(level) {
  if (level === 'Light') return 'metric-value is-good';
  if (level === 'Moderate') return 'metric-value is-warn';
  return 'metric-value is-bad';
}

function boardingTip(level) {
  if (level === 'Light') return 'Good time to board.';
  if (level === 'Moderate') return 'Board soon; volume is rising.';
  return 'Expect crowding and possible delay.';
}

export default function CameraPanel({ selectedRoute, history, addSample }) {
  const { videoRef, canvasRef, mediaStream, activityScore, cameraStatus, startCamera, stopCamera } = useCamera();
  const peopleCount = useYoloFeed();
  const yoloActive = peopleCount !== null;

  const [activeSource, setActiveSource] = useState('camera');

  const effectiveScore = activeSource === 'yolo' && yoloActive
    ? peopleToScore(peopleCount)
    : activityScore;
  const level = demandLevel(effectiveScore);
  const hasData = mediaStream !== null || yoloActive;

  // Keep ref to latest score so the sampling timer always reads fresh value
  const scoreRef = useRef(effectiveScore);
  useEffect(() => { scoreRef.current = effectiveScore; }, [effectiveScore]);

  // Periodic demand sampling while camera is active
  useEffect(() => {
    if (!mediaStream) return;
    const initId = setTimeout(() => {
      addSample(selectedRoute, scoreRef.current, demandLevel(scoreRef.current));
    }, 3000);
    const id = setInterval(() => {
      addSample(selectedRoute, scoreRef.current, demandLevel(scoreRef.current));
    }, SAMPLE_INTERVAL_MS);
    return () => { clearTimeout(initId); clearInterval(id); };
  }, [mediaStream, selectedRoute, addSample]);

  const routeHistory = history.filter(e => e.routeCode === selectedRoute);
  const trend = computeTrend(routeHistory);
  const recent = routeHistory.slice(-12).reverse();

  return (
    <section className="panel camera-panel">
      <div className="panel-title-wrap">
        <h2>Stop Camera</h2>
        <button className="btn" onClick={mediaStream ? stopCamera : startCamera}>
          {mediaStream ? 'Stop Camera' : 'Start Camera'}
        </button>
      </div>

      <div className="source-tabs">
        <button
          className={`tab-btn ${activeSource === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveSource('camera')}
        >
          Pixel-Diff
        </button>
        <button
          className={`tab-btn ${activeSource === 'yolo' ? 'active' : ''}`}
          onClick={() => setActiveSource('yolo')}
        >
          YOLO{yoloActive ? ' \u2713' : ' (offline)'}
        </button>
      </div>

      <div className="video-shell">
        <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
        <canvas ref={canvasRef} className="analysis-canvas" width={640} height={360} tabIndex={-1} />
        <div className="camera-status">{cameraStatus}</div>
        {yoloActive && (
          <div className="yolo-badge">
            YOLO &middot; {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
          </div>
        )}
      </div>

      <div className="metrics-row">
        <article className="metric">
          <p className="metric-label">Crowd Activity</p>
          <p className="metric-value">{hasData ? `${effectiveScore}/100` : '--'}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Estimated Occupancy</p>
          <p className={hasData ? occupancyClass(level) : 'metric-value'}>{hasData ? level : '--'}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Recommended Action</p>
          <p className="metric-value">{hasData ? boardingTip(level) : '--'}</p>
        </article>
      </div>

      <div className="metrics-row demand-row">
        <article className="metric">
          <p className="metric-label">Samples (Route)</p>
          <p className="metric-value">{routeHistory.length}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Forecast +15m</p>
          <p className="metric-value">{trend.forecast15 !== null ? formatForecast(trend.forecast15) : '--'}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Forecast +30m</p>
          <p className="metric-value">{trend.forecast30 !== null ? formatForecast(trend.forecast30) : '--'}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Trend</p>
          <p className="metric-value">{trend.trendLabel}</p>
        </article>
      </div>

      <p className="sampling-note">Demand snapshots are stored once per minute while camera is active.</p>
      <Sparkline entries={routeHistory} />

      <div className="table-wrap demand-table">
        <table>
          <thead>
            <tr><th>Time</th><th>Route</th><th>Activity</th><th>Level</th></tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td colSpan={4}>No demand samples yet.</td></tr>
            ) : recent.map((entry, i) => (
              <tr key={i}>
                <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                <td>{entry.routeCode}</td>
                <td>{entry.activityScore}/100</td>
                <td>{entry.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
