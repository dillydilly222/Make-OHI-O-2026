import { useEffect, useRef } from 'react';
import { clamp } from '../utils';

export default function Sparkline({ entries }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#e6e2da';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (H / 5) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (!entries.length) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Archivo';
      ctx.fillText('No demand samples yet', 12, 20);
      return;
    }

    const data = entries.slice(-40);
    const xStep = data.length <= 1 ? W : W / (data.length - 1);
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c82127';
    data.forEach((entry, i) => {
      const x = i * xStep;
      const y = H - (clamp(Number(entry.activityScore) || 0, 0, 100) / 100) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [entries]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={120}
      className="sparkline"
      aria-label="Demand trend chart"
    />
  );
}
