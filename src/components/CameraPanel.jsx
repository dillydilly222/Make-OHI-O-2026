import { useEffect, useRef } from 'react';
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
  const peopleCount = useYoloFeed();
  const hasData = peopleCount !== null;

  const activityScore = hasData ? peopleToScore(peopleCount) : 0;
  const level = demandLevel(activityScore);

  const scoreRef = useRef(activityScore);
  useEffect(() => { scoreRef.current = activityScore; }, [activityScore]);

  // Sample demand once per minute while ESP camera is streaming
  useEffect(() => {
    if (!hasData) return;
    const initId = setTimeout(() => {
      addSample(selectedRoute, scoreRef.current, demandLevel(scoreRef.current));
    }, 3000);
    const id = setInterval(() => {
      addSample(selectedRoute, scoreRef.current, demandLevel(scoreRef.current));
    }, SAMPLE_INTERVAL_MS);
    return () => { clearTimeout(initId); clearInterval(id); };
  }, [hasData, selectedRoute, addSample]);

  const routeHistory = history.filter(e => e.routeCode === selectedRoute);
  const trend = computeTrend(routeHistory);
  const recent = routeHistory.slice(-12).reverse();

  return (
    <section className="panel camera-panel">
      <h2>Stop Monitor</h2>

      <div className="people-counter">
        <p className="people-count-value">{hasData ? peopleCount : '--'}</p>
        <p className="people-count-label">People at Stop</p>
        {!hasData && (
          <p className="yolo-offline">
            ESP camera offline &mdash; run <code>main.py</code> to connect
          </p>
        )}
      </div>

      <div className="metrics-row">
        <article className="metric">
          <p className="metric-label">Activity Score</p>
          <p className="metric-value">{hasData ? `${activityScore}/100` : '--'}</p>
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

      <p className="sampling-note">Demand snapshots stored once per minute while ESP camera is active.</p>
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
