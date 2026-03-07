import { useEffect, useRef } from 'react';
import { useYoloFeed } from '../hooks/useYoloFeed';
import { useRecommendation } from '../hooks/useRecommendation';
import { SAMPLE_INTERVAL_MS } from '../constants';
import { demandLevel } from '../utils';

function peopleToScore(count) {
  return Math.min(Math.round((count / 20) * 100), 100);
}

function occupancyClass(level) {
  if (level === 'Light') return 'metric-value is-good';
  if (level === 'Moderate') return 'metric-value is-warn';
  return 'metric-value is-bad';
}

// Static fallback used when LLM is unavailable
function boardingTip(level) {
  if (level === 'Light') return 'Good time to board.';
  if (level === 'Moderate') return 'Board soon; volume is rising.';
  return 'Expect crowding and possible delay.';
}

function actionText(hasData, loading, recommendation, level) {
  if (!hasData) return '--';
  if (loading) return 'Thinking\u2026';
  return recommendation ?? boardingTip(level);
}

export default function CameraPanel({ selectedRoute, addSample }) {
  const peopleCount = useYoloFeed();
  const hasData = peopleCount !== null;

  const activityScore = hasData ? peopleToScore(peopleCount) : 0;
  const level = demandLevel(activityScore);

  const { recommendation, loading } = useRecommendation(peopleCount, activityScore, level);

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

  return (
    <section className="panel camera-panel">
      <h2>Stop Monitor</h2>

      <div className="people-counter">
        <p className="people-count-value">{hasData ? peopleCount : '--'}</p>
        <p className="people-count-label">People at Stop</p>
        {!hasData && (
          <p className="yolo-offline">
            ESP camera offline &mdash; run <code>detect.py</code> to connect
          </p>
        )}
      </div>

      <div className="metrics-row metrics-row--two">
        <article className="metric">
          <p className="metric-label">Estimated Occupancy</p>
          <p className={hasData ? occupancyClass(level) : 'metric-value'}>{hasData ? level : '--'}</p>
        </article>
        <article className="metric">
          <p className="metric-label">Recommended Action</p>
          <p className="metric-value">{actionText(hasData, loading, recommendation, level)}</p>
        </article>
      </div>
    </section>
  );
}
