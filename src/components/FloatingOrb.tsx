
"use client";

import {useEffect, useRef} from "react";

/**
 * Animated floating orb decoration using pure canvas rendering.
 * Provides a subtle ambient glow effect in the background.
 */
export function FloatingOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx!.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!canvas || !ctx) return;

      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);
      time += 0.003;

      // Primary orb
      const x1 = w * 0.3 + Math.sin(time * 0.7) * w * 0.15;
      const y1 = h * 0.3 + Math.cos(time * 0.5) * h * 0.1;
      const r1 = Math.min(w, h) * 0.25;

      const gradient1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
      gradient1.addColorStop(0, "rgba(139, 92, 246, 0.06)");
      gradient1.addColorStop(0.5, "rgba(139, 92, 246, 0.02)");
      gradient1.addColorStop(1, "rgba(139, 92, 246, 0)");

      ctx.fillStyle = gradient1;
      ctx.fillRect(0, 0, w, h);

      // Secondary orb
      const x2 = w * 0.7 + Math.cos(time * 0.6) * w * 0.12;
      const y2 = h * 0.7 + Math.sin(time * 0.8) * h * 0.08;
      const r2 = Math.min(w, h) * 0.2;

      const gradient2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
      gradient2.addColorStop(0, "rgba(217, 70, 239, 0.04)");
      gradient2.addColorStop(0.5, "rgba(217, 70, 239, 0.015)");
      gradient2.addColorStop(1, "rgba(217, 70, 239, 0)");

      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, w, h);

      // Tertiary orb
      const x3 = w * 0.5 + Math.sin(time * 0.9 + 2) * w * 0.2;
      const y3 = h * 0.5 + Math.cos(time * 0.4 + 1) * h * 0.15;
      const r3 = Math.min(w, h) * 0.18;

      const gradient3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
      gradient3.addColorStop(0, "rgba(6, 182, 212, 0.03)");
      gradient3.addColorStop(1, "rgba(6, 182, 212, 0)");

      ctx.fillStyle = gradient3;
      ctx.fillRect(0, 0, w, h);

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        width: "100vw",
        height: "100vh"
      }}
      aria-hidden
    />
  );
}


