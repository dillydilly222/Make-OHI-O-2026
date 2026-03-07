import { useState, useEffect } from 'react';
import { YOLO_SERVER, YOLO_POLL_MS } from '../constants';

export function useYoloFeed() {
  const [peopleCount, setPeopleCount] = useState(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(YOLO_SERVER);
        if (!res.ok) return;
        const data = await res.json();
        setPeopleCount(data.count);
      } catch {
        // Server not running — silently skip
      }
    }
    poll();
    const id = setInterval(poll, YOLO_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return peopleCount;
}
