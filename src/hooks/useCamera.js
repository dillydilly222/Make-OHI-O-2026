import { useState, useRef, useCallback, useEffect } from 'react';
import { ANALYSIS_INTERVAL_MS } from '../constants';
import { clamp } from '../utils';

export function useCamera() {
  const [mediaStream, setMediaStream] = useState(null);
  const [activityScore, setActivityScore] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('Camera idle');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const previousFrameRef = useRef(null);
  const analysisTimerRef = useRef(null);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (!previousFrameRef.current) {
      previousFrameRef.current = new Uint8ClampedArray(data);
      return;
    }

    let diffTotal = 0;
    let sampleCount = 0;
    for (let i = 0; i < data.length; i += 16) {
      const cur = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const prev = (previousFrameRef.current[i] + previousFrameRef.current[i + 1] + previousFrameRef.current[i + 2]) / 3;
      diffTotal += Math.abs(cur - prev);
      sampleCount++;
    }

    previousFrameRef.current = new Uint8ClampedArray(data);
    const normalized = sampleCount === 0 ? 0 : diffTotal / sampleCount;
    setActivityScore(clamp(Math.round(normalized * 1.8), 0, 100));
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMediaStream(stream);
      setCameraStatus('Camera active | sampling every minute');
      previousFrameRef.current = null;
      analysisTimerRef.current = setInterval(analyzeFrame, ANALYSIS_INTERVAL_MS);
    } catch (err) {
      setCameraStatus('Camera unavailable (permission/device issue)');
      console.error(err);
    }
  }, [analyzeFrame]);

  const stopCamera = useCallback(() => {
    setMediaStream(prev => {
      if (prev) prev.getTracks().forEach(t => t.stop());
      return null;
    });
    if (analysisTimerRef.current) {
      clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    previousFrameRef.current = null;
    setCameraStatus('Camera idle');
    setActivityScore(0);
  }, []);

  useEffect(() => {
    return () => {
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    };
  }, []);

  return { videoRef, canvasRef, mediaStream, activityScore, cameraStatus, startCamera, stopCamera };
}
