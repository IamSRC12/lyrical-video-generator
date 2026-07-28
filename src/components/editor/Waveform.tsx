
"use client";

import {useEffect, useRef} from "react";

type WaveformProps = {
  audioUrl: string;
  playhead: number;
  duration: number;
  beats?: number[];
  onSeek: (time: number) => void;
};

export function Waveform({audioUrl, playhead, duration, beats = [], onSeek}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useRef<Float32Array | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Decode audio and extract waveform data
  useEffect(() => {
    let cancelled = false;

    async function decode() {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const context = new AudioContext();
        const buffer = await context.decodeAudioData(arrayBuffer);
        const channel = buffer.getChannelData(0);

        // Downsample to ~2000 points for rendering
        const targetPoints = 2000;
        const step = Math.max(1, Math.floor(channel.length / targetPoints));
        const sampled = new Float32Array(Math.ceil(channel.length / step));

        for (let i = 0; i < sampled.length; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, channel.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channel[j]);
            if (abs > max) max = abs;
          }
          sampled[i] = max;
        }

        if (!cancelled) {
          waveformData.current = sampled;
        }

        await context.close();
      } catch {
        // Waveform display is non-critical
      }
    }

    decode();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Render waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const data = waveformData.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw waveform bars
    const barWidth = Math.max(1, w / data.length);

    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * w;
      const barHeight = data[i] * mid * 0.85;
      const progress = x / w;
      const playedProgress = duration > 0 ? playhead / duration : 0;

      if (progress <= playedProgress) {
        ctx.fillStyle = "rgba(139, 92, 246, 0.8)";
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      }

      ctx.fillRect(x, mid - barHeight, barWidth - 0.5, barHeight * 2);
    }

    // Draw beat markers
    if (beats.length > 0) {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
      ctx.lineWidth = 1;

      for (const beat of beats) {
        const x = (beat / duration) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    // Draw playhead
    const playheadX = (playhead / Math.max(duration, 0.01)) * w;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, h);
    ctx.stroke();

    // Playhead glow
    const gradient = ctx.createRadialGradient(
      playheadX, mid, 0,
      playheadX, mid, 20
    );
    gradient.addColorStop(0, "rgba(139, 92, 246, 0.3)");
    gradient.addColorStop(1, "rgba(139, 92, 246, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(playheadX - 20, 0, 40, h);
  });

  function handleClick(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;

    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onSeek(ratio * duration);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full cursor-crosshair"
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{display: "block"}}
      />
    </div>
  );
}


