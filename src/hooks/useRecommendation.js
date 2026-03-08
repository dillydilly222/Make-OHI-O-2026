import { useState, useEffect, useRef } from 'react';

const RECOMMENDATION_URL = 'http://localhost:5050/recommendation';
const DEBOUNCE_MS = 2000;

export function useRecommendation(peopleCount, activityScore, level, weather) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (peopleCount === null) {
      setRecommendation(null);
      return;
    }

    setLoading(true);

    const timer = setTimeout(() => {
      if (cancelRef.current) cancelRef.current();
      let cancelled = false;
      cancelRef.current = () => { cancelled = true; };

      fetch(RECOMMENDATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: peopleCount, score: activityScore, level, weather }),
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
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); };
  }, [peopleCount, activityScore, level, weather]); // eslint-disable-line react-hooks/exhaustive-deps

  return { recommendation, loading };
}
