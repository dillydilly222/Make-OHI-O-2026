import { useState, useCallback } from 'react';
import { DEMAND_STORAGE_KEY } from '../constants';

function loadHistory() {
  try {
    const raw = localStorage.getItem(DEMAND_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(DEMAND_STORAGE_KEY, JSON.stringify(history));
}

export function useDemandHistory() {
  const [history, setHistory] = useState(loadHistory);

  const addSample = useCallback((routeCode, activityScore, level) => {
    setHistory(prev => {
      const next = [...prev, { timestamp: Date.now(), routeCode, activityScore, level }];
      const trimmed = next.length > 1440 ? next.slice(-1440) : next;
      saveHistory(trimmed);
      return trimmed;
    });
  }, []);

  return { history, addSample };
}
