export type BeatAnalysis = {
  bpm: number;
  beats: number[];
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

  await context.close();

  return {
    bpm: Math.round(bpm),
    beats: candidateBeats
  };
}
