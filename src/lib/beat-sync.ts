export function getBeatPulse(
  beats: number[],
  time: number,
  pulseDuration = 0.14
): number {
  if (!beats.length) return 0;

  let low = 0;
  let high = beats.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (beats[middle] < time) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const candidates = [
    beats[low],
    beats[Math.max(0, low - 1)]
  ].filter((beat): beat is number => Number.isFinite(beat));

  const distance = Math.min(
    ...candidates.map((beat) => Math.abs(beat - time))
  );

  if (distance >= pulseDuration) return 0;

  const linear = 1 - distance / pulseDuration;
  return linear * linear;
}
