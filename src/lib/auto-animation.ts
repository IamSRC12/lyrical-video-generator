import type { AnimationName } from "./editor-schema";

export function chooseAutoAnimation(input: {
  text: string;
  duration: number;
  alignmentConfidence: number;
  beatNearStart: boolean;
}): AnimationName {
  const { text, duration, alignmentConfidence, beatNearStart } = input;
  const words = text.trim().split(/\s+/u).filter(Boolean).length;

  if (alignmentConfidence < 0.6 || duration < 0.65) return "fade";
  if (words <= 5 && /[!?]$/u.test(text.trim())) return "pop";
  if (beatNearStart && words <= 8 && duration >= 0.9) return "neon_pulse";
  if (words >= 12) return "fade";
  return "slide_up";
}
