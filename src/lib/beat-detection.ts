export type BeatAnalysis = {
  bpm: number;
  beats: number[];
  duration: number;
};

export async function detectBeats(file: File): Promise<BeatAnalysis> {
  const context = new AudioContext();
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const windowSize = 1024;
  const hop = 512;
  const energies: number[] = [];

  for (let start = 0; start + windowSize < channel.length; start += hop) {
    let energy = 0;

    for (let index = start; index < start + windowSize; index++) {
      energy += channel[index] * channel[index];
    }

    energies.push(Math.sqrt(energy / windowSize));
  }

  const novelty = energies.map((value, index) =>
    Math.max(0, value - (energies[index - 1] ?? value))
  );

  const mean = novelty.reduce((sum, value) => sum + value, 0) /
    Math.max(1, novelty.length);

  const variance =
    novelty.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, novelty.length);

  const threshold = mean + Math.sqrt(variance) * 1.25;
  const candidateBeats: number[] = [];
  const minimumGap = 0.22;

  for (let index = 1; index < novelty.length - 1; index++) {
    const time = (index * hop) / sampleRate;

    if (
      novelty[index] > threshold &&
      novelty[index] >= novelty[index - 1] &&
      novelty[index] >= novelty[index + 1] &&
      time - (candidateBeats.at(-1) ?? -Infinity) >= minimumGap
    ) {
      candidateBeats.push(time);
    }
  }

  const intervals = candidateBeats
    .slice(1)
    .map((beat, index) => beat - candidateBeats[index])
    .filter((interval) => interval >= 0.25 && interval <= 1.5);

  const medianInterval =
    intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)] ?? 0.5;

  let bpm = 60 / medianInterval;

  while (bpm < 70) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  const duration = buffer.duration;
  const period = 60 / bpm;

  function distanceToGrid(time: number, phase: number): number {
    const position = ((time - phase) % period + period) % period;
    return Math.min(position, period - position);
  }

  const phaseCandidates = candidateBeats.slice(
    0,
    Math.min(candidateBeats.length, 80)
  );

  let bestPhase = phaseCandidates[0] ?? 0;
  let bestScore = -Infinity;

  for (const phaseCandidate of phaseCandidates) {
    const phase =
      ((phaseCandidate % period) + period) % period;

    let score = 0;

    for (const onset of candidateBeats) {
      const distance = distanceToGrid(onset, phase);
      score += Math.exp(-((distance / 0.07) ** 2));
    }

    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }

  const beatGrid: number[] = [];

  for (let beat = bestPhase; beat <= duration; beat += period) {
    let snapped = beat;
    let nearestDistance = 0.09;

    for (const onset of candidateBeats) {
      const distance = Math.abs(onset - beat);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        snapped = onset;
      }
    }

    if (
      snapped >= 0 &&
      snapped <= duration &&
      snapped - (beatGrid.at(-1) ?? -Infinity) > period * 0.55
    ) {
      beatGrid.push(snapped);
    }
  }

  await context.close();

  return {
    bpm: Math.round(bpm),
    beats: beatGrid.sort((a, b) => a - b),
    duration
  };
}
