import type {AnimationName} from "@/lib/editor-schema";

type AnimationStyle = {
  opacity: number;
  transform: string;
  textShadow?: string;
  filter?: string;
};

/**
 * Returns CSS properties for a given animation at a specific progress (0 → 1).
 */
export function getAnimationStyle(
  animation: AnimationName,
  progress: number
): AnimationStyle {
  const clamped = Math.max(0, Math.min(1, progress));

  switch (animation) {
    case "fade":
      return {
        opacity: clamped,
        transform: `translateY(${(1 - clamped) * 12}px)`
      };

    case "slide_up":
      return {
        opacity: Math.min(1, clamped * 2),
        transform: `translateY(${(1 - clamped) * 60}px)`
      };

    case "pop": {
      const scale = clamped < 0.5
        ? 0.3 + clamped * 2.4
        : 1.5 - (clamped - 0.5) * 1.0;
      return {
        opacity: Math.min(1, clamped * 3),
        transform: `scale(${Math.max(0.3, Math.min(1.5, scale))})`
      };
    }

    case "neon_pulse": {
      const glowIntensity = 10 + Math.sin(clamped * Math.PI * 4) * 8;
      return {
        opacity: clamped,
        transform: `scale(${1 + Math.sin(clamped * Math.PI * 2) * 0.03})`,
        textShadow: [
          `0 0 ${glowIntensity}px rgba(139, 92, 246, 0.8)`,
          `0 0 ${glowIntensity * 2}px rgba(139, 92, 246, 0.4)`,
          `0 0 ${glowIntensity * 3}px rgba(217, 70, 239, 0.2)`
        ].join(", ")
      };
    }

    case "zoom_blur": {
      const scale = 0.85 + clamped * 0.15;
      const blur = Math.max(0, (1 - clamped) * 6);
      return {
        opacity: clamped,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`
      };
    }

    case "rain":
      return {
        opacity: clamped,
        transform: `translateY(${(1 - clamped) * -40}px)`
      };

    case "shake": {
      const shakeX = clamped < 0.8
        ? Math.sin(clamped * Math.PI * 8) * 4 * (1 - clamped)
        : 0;
      return {
        opacity: Math.min(1, clamped * 2.5),
        transform: `translateX(${shakeX}px)`
      };
    }

    default:
      return {
        opacity: clamped,
        transform: "none"
      };
  }
}
