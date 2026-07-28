"use client";

import { useEditorStore } from "@/stores/editor-store";
import { useEffect, useRef } from "react";

export function Waveform() {
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformDataRef = useRef<Float32Array | null>(null);

  // Decode audio data once into downsampled 2000 points
  useEffect(() => {
    if (!project?.audioUrl) return;

    let isCancelled = false;

    async function loadAudioWaveform() {
      try {
        const response = await fetch(project!.audioUrl);
        const arrayBuffer = await response.arrayBuffer();

        const audioCtx = new AudioContext();
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = buffer.getChannelData(0);

        const samples = 1800;
        const step = Math.floor(rawData.length / samples);
        const downsampled = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, rawData.length);
          for (let j = start; j < end; j++) {
            const val = Math.abs(rawData[j]);
            if (val > max) max = val;
          }
          downsampled[i] = max;
        }

        if (!isCancelled) {
          waveformDataRef.current = downsampled;
          drawCanvas();
        }

        await audioCtx.close();
      } catch (err) {
        console.warn("Waveform decoding failed:", err);
      }
    }

    loadAudioWaveform();

    return () => {
      isCancelled = true;
    };
  }, [project?.audioUrl]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const duration = project.duration || 10;
    const data = waveformDataRef.current;

    // Draw baseline
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Draw detected beat lines
    if (project.beats?.length) {
      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 1;
      for (const beat of project.beats) {
        const x = (beat / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw waveform bars
    if (data && data.length) {
      const barWidth = width / data.length;
      for (let i = 0; i < data.length; i++) {
        const x = i * barWidth;
        const barHeight = data[i] * (height * 0.85);

        const timeAtBar = (i / data.length) * duration;
        if (timeAtBar <= currentTime) {
          ctx.fillStyle = "#eab308"; // Active yellow
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        }

        ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, barWidth - 0.5), barHeight);
      }
    }

    // Draw playhead vertical marker
    const playheadX = (currentTime / duration) * width;
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  };

  useEffect(() => {
    drawCanvas();
  }, [currentTime, project]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !project) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = (clickX / rect.width) * project.duration;
    setCurrentTime(time);
  };

  if (!project) return null;

  return (
    <div className="relative h-16 w-full shrink-0 bg-zinc-950 px-2 py-1">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="h-full w-full cursor-pointer rounded-lg border border-zinc-850"
      />
    </div>
  );
}
