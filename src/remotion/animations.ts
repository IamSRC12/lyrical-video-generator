
import type {AnimationName} from "@/lib/editor-schema";

type AnimationStyle = {
  opacity: number;
  transform: string;
  textShadow?: string;
  filter?: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  const t = clamp(value);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(value: number) {
  const t = clamp(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function getAnimationStyle(
  animation: AnimationName,
  progress: number
): AnimationStyle {
  const t = clamp(progress);
  const smooth = easeOutCubic(t);

  switch (animation) {
    case "fade":
      return {
        opacity: smooth,
        transform: `translateY(${(1 - smooth) * 18}px)`
      };

    case "slide_up":
      return {
        opacity: clamp(t * 1.8),
        transform: `translate3d(0, ${(1 - smooth) * 90}px, 0)`
      };

    case "pop": {
      const scale = 0.55 + easeOutBack(t) * 0.45;

      return {
        opacity: clamp(t * 2.5),
        transform: `scale(${scale})`
      };
    }

    case "neon_pulse": {
      const pulse = 0.5 + Math.sin(t * Math.PI * 5) * 0.5;
      const glow = 14 + pulse * 20;

      return {
        opacity: clamp(t * 2),
        transform: `scale(${0.96 + smooth * 0.04 + pulse * 0.015})`,
        textShadow: [
          `0 0 ${glow}px rgba(139,92,246,.95)`,
          `0 0 ${glow * 1.8}px rgba(217,70,239,.55)`,
          `0 8px 28px rgba(0,0,0,.65)`
        ].join(",")
      };
    }

    case "zoom_blur":
      return {
        opacity: clamp(t * 2),
        transform: `scale(${1.3 - smooth * 0.3})`,
        filter: `blur(${(1 - smooth) * 14}px)`
      };

    case "rain":
      return {
        opacity: clamp(t * 1.8),
        transform: `translate3d(0, ${(-1 + smooth) * 100}px, 0)`
      };

    case "shake": {
      const decay = 1 - t;
      const x = Math.sin(t * Math.PI * 14) * 14 * decay;
      const rotation = Math.sin(t * Math.PI * 10) * 1.5 * decay;

      return {
        opacity: clamp(t * 2.5),
        transform: `translateX(${x}px) rotate(${rotation}deg)`
      };
    }

    default:
      return {
        opacity: 1,
        transform: "none"
      };
  }
}


