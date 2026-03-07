import { useState, useEffect } from 'react';

const RECOMMENDATION_URL = 'http://localhost:5050/recommendation';

export function useRecommendation(peopleCount, activityScore, level) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);

  // Only re-query when level changes or data availability toggles
  const key = peopleCount !== null ? level : null;

  useEffect(() => {
    if (key === null) {
      setRecommendation(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(RECOMMENDATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: peopleCount, score: activityScore, level }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled) {
          setRecommendation(data?.recommendation ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { recommendation, loading };
}
