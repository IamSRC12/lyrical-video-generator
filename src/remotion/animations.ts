import type { AnimationName } from "@/lib/editor-schema";
import { interpolate, spring } from "remotion";

export type AnimationStyle = {
  opacity: number;
  transform: string;
  filter?: string;
};

export function getAnimationStyle(options: {
  animation: AnimationName;
  frame: number;
  fps: number;
  segmentStartFrame: number;
  segmentEndFrame: number;
  intensity?: number;
}): AnimationStyle {
  const {
    animation,
    frame,
    fps,
    segmentStartFrame,
    segmentEndFrame,
    intensity = 1.0
  } = options;

  const localFrame = frame - segmentStartFrame;
  const durationFrames = Math.max(1, segmentEndFrame - segmentStartFrame);

  // Entrance & Exit progress (0 to 1)
  const fadeInProgress = interpolate(localFrame, [0, Math.min(10, durationFrames / 3)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  const fadeOutProgress = interpolate(
    frame,
    [segmentEndFrame - Math.min(10, durationFrames / 3), segmentEndFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = fadeInProgress * fadeOutProgress;

  switch (animation) {
    case "fade": {
      return {
        opacity,
        transform: "none"
      };
    }

    case "slide_up": {
      const translateY = interpolate(fadeInProgress, [0, 1], [60 * intensity, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      });
      return {
        opacity,
        transform: `translateY(${translateY}px)`
      };
    }

    case "pop": {
      const springVal = spring({
        frame: localFrame,
        fps,
        config: { damping: 12, stiffness: 200 }
      });
      const scale = interpolate(springVal, [0, 1], [0.5, 1.0 * intensity]);
      return {
        opacity,
        transform: `scale(${scale})`
      };
    }

    case "neon_pulse": {
      const pulse = Math.sin(localFrame * 0.2) * 0.15 * intensity + 1.0;
      const glowBlur = Math.abs(Math.sin(localFrame * 0.15)) * 25 * intensity;
      return {
        opacity,
        transform: `scale(${pulse})`,
        filter: `drop-shadow(0 0 ${glowBlur}px rgba(253, 224, 71, 0.8))`
      };
    }

    case "zoom_blur": {
      const scale = interpolate(fadeInProgress, [0, 1], [1.6 * intensity, 1.0]);
      const blur = interpolate(fadeInProgress, [0, 1], [12 * intensity, 0]);
      return {
        opacity,
        transform: `scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined
      };
    }

    case "rain": {
      const translateY = interpolate(localFrame, [0, durationFrames], [-40 * intensity, 40 * intensity]);
      return {
        opacity,
        transform: `translateY(${translateY}px)`
      };
    }

    case "shake": {
      const shakeX = Math.sin(localFrame * 0.8) * 8 * intensity;
      const shakeY = Math.cos(localFrame * 0.6) * 6 * intensity;
      return {
        opacity,
        transform: `translate(${shakeX}px, ${shakeY}px)`
      };
    }

    default:
      return { opacity, transform: "none" };
  }
}
