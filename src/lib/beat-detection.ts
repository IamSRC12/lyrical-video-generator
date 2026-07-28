export type BeatDetectionResult = {
  bpm: number;
  beats: number[];
  confidence: number;
};

export async function detectBeats(audioBuffer: AudioBuffer): Promise<BeatDetectionResult> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Mono / channel 0
  const length = channelData.length;

  // Window size for short-time energy calculations (~10ms)
  const windowSize = Math.floor(sampleRate * 0.01);
  const totalWindows = Math.floor(length / windowSize);
  const energies = new Float32Array(totalWindows);

  for (let w = 0; w < totalWindows; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const val = channelData[start + i];
      sum += val * val;
    }
    energies[w] = Math.sqrt(sum / windowSize);
  }

  // Adaptive threshold over sliding window of ~43 windows (~430ms)
  const halfWin = 21;
  const onsets: number[] = [];

  for (let i = halfWin; i < totalWindows - halfWin; i++) {
    let localSum = 0;
    for (let j = i - halfWin; j <= i + halfWin; j++) {
      localSum += energies[j];
    }
    const localMean = localSum / (halfWin * 2 + 1);
    const threshold = localMean * 1.45;

    // Peak condition
    if (
      energies[i] > threshold &&
      energies[i] > energies[i - 1] &&
      energies[i] >= energies[i + 1]
    ) {
      const timeInSec = (i * windowSize) / sampleRate;
      onsets.push(timeInSec);
    }
  }

  // Enforce minimum onset interval of 200ms (max 300 BPM)
  const minInterval = 0.2;
  const filteredBeats: number[] = [];
  for (const time of onsets) {
    if (
      filteredBeats.length === 0 ||
      time - filteredBeats[filteredBeats.length - 1] >= minInterval
    ) {
      filteredBeats.push(time);
    }
  }

  // Calculate inter-onset intervals (IOI) for BPM estimation
  const intervals: number[] = [];
  for (let i = 1; i < filteredBeats.length; i++) {
    const diff = filteredBeats[i] - filteredBeats[i - 1];
    if (diff >= 0.3 && diff <= 1.2) { // 50 to 200 BPM equivalent interval
      intervals.push(diff);
    }
  }

  let estimatedBpm = 120;
  let confidence = 0.5;

  if (intervals.length > 0) {
    const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
    let rawBpm = Math.round(60 / medianInterval);

    // Normalize BPM between 70 and 160 (half-time / double-time adjustment)
    while (rawBpm < 70) rawBpm *= 2;
    while (rawBpm > 160) rawBpm /= 2;

    estimatedBpm = Math.round(rawBpm);
    confidence = Math.min(1.0, intervals.length / (audioBuffer.duration * 1.5));
  }

  return {
    bpm: estimatedBpm,
    beats: filteredBeats.map((b) => Number(b.toFixed(3))),
    confidence: Number(confidence.toFixed(2))
  };
}
