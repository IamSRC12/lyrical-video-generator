export function getRhythmPulse(
  beats: number[],
  time: number
): number {
  if (!beats.length) return 0;

  let nearestDistance = Infinity;

  for (const beat of beats) {
    const distance = Math.abs(beat - time);

    if (distance < nearestDistance) {
      nearestDistance = distance;
    }

    if (beat > time + 0.15) break;
  }

  if (nearestDistance >= 0.12) return 0;

  const progress = 1 - nearestDistance / 0.12;
  return progress * progress;
}

export function getBeatPulse(
  beats: number[],
  time: number
): number {
  return getRhythmPulse(beats, time);
}
