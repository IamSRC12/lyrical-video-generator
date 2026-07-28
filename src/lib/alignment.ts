import type { GroqWord } from "@/services/groq";
import { chooseAutoAnimation } from "./auto-animation";
import type { LyricSegment, TimedWord } from "./editor-schema";

type LyricToken = {
  original: string;
  normalized: string;
  lineIndex: number;
};

function normalizeToken(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\p{Letter}\p{Number}']/gu, "");
}

function tokenizeLyrics(lines: string[]): LyricToken[] {
  return lines.flatMap((line, lineIndex) =>
    line
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .map((original) => ({
        original,
        normalized: normalizeToken(original),
        lineIndex
      }))
  );
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }

  return previous[b.length];
}

function substitutionCost(lyricNorm: string, whisperNorm: string): number {
  if (!lyricNorm || !whisperNorm) return 1.0;
  if (lyricNorm === whisperNorm) return 0.0;

  const maxLen = Math.max(lyricNorm.length, whisperNorm.length, 1);
  const distance = levenshteinDistance(lyricNorm, whisperNorm);
  const ratio = distance / maxLen;

  if (ratio <= 0.2) return 0.2;
  if (ratio <= 0.45) return 0.6;
  return 1.4;
}

function globalDPAlign(
  lyricTokens: LyricToken[],
  whisperWords: GroqWord[]
): Array<{ whisperIndex: number | null; confidence: number }> {
  const n = lyricTokens.length;
  const m = whisperWords.length;
  const gapLyric = 0.85;
  const gapWhisper = 0.6;

  const scores: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );

  const moves: Array<Array<"diag" | "up" | "left" | null>> = Array.from(
    { length: n + 1 },
    () => Array(m + 1).fill(null)
  );

  for (let i = 1; i <= n; i++) {
    scores[i][0] = i * gapLyric;
    moves[i][0] = "up";
  }

  for (let j = 1; j <= m; j++) {
    scores[0][j] = j * gapWhisper;
    moves[0][j] = "left";
  }

  for (let i = 1; i <= n; i++) {
    const lNorm = lyricTokens[i - 1].normalized;
    for (let j = 1; j <= m; j++) {
      const wNorm = normalizeToken(whisperWords[j - 1].word);
      const subCost = substitutionCost(lNorm, wNorm);

      const diagonal = scores[i - 1][j - 1] + subCost;
      const up = scores[i - 1][j] + gapLyric;
      const left = scores[i][j - 1] + gapWhisper;

      const minVal = Math.min(diagonal, up, left);
      scores[i][j] = minVal;

      if (minVal === diagonal) {
        moves[i][j] = "diag";
      } else if (minVal === up) {
        moves[i][j] = "up";
      } else {
        moves[i][j] = "left";
      }
    }
  }

  const results: Array<{ whisperIndex: number | null; confidence: number }> = Array(
    n
  ).fill(null).map(() => ({ whisperIndex: null, confidence: 0 }));

  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    const move = moves[i][j];

    if (move === "diag") {
      const lNorm = lyricTokens[i - 1].normalized;
      const wNorm = normalizeToken(whisperWords[j - 1].word);
      const subCost = substitutionCost(lNorm, wNorm);

      if (subCost <= 0.8) {
        const confidence = Math.max(0, 1 - subCost);
        results[i - 1] = { whisperIndex: j - 1, confidence };
      } else {
        results[i - 1] = { whisperIndex: null, confidence: 0.2 };
      }

      i--;
      j--;
    } else if (move === "up") {
      results[i - 1] = { whisperIndex: null, confidence: 0 };
      i--;
    } else {
      j--;
    }
  }

  return results;
}

function interpolateTimestamps(
  tokenIndex: number,
  mapping: Array<{ whisperIndex: number | null; confidence: number }>,
  whisperWords: GroqWord[]
): { start: number; end: number; confidence: number; source: "groq" | "interpolated" } {
  const item = mapping[tokenIndex];

  if (item.whisperIndex !== null && whisperWords[item.whisperIndex]) {
    const w = whisperWords[item.whisperIndex];
    return {
      start: w.start,
      end: Math.max(w.start + 0.08, w.end),
      confidence: item.confidence,
      source: "groq"
    };
  }

  let leftIndex = tokenIndex - 1;
  while (leftIndex >= 0 && mapping[leftIndex].whisperIndex === null) {
    leftIndex--;
  }

  let rightIndex = tokenIndex + 1;
  while (rightIndex < mapping.length && mapping[rightIndex].whisperIndex === null) {
    rightIndex++;
  }

  const leftWord =
    leftIndex >= 0 && mapping[leftIndex].whisperIndex !== null
      ? whisperWords[mapping[leftIndex].whisperIndex!]
      : null;

  const rightWord =
    rightIndex < mapping.length && mapping[rightIndex].whisperIndex !== null
      ? whisperWords[mapping[rightIndex].whisperIndex!]
      : null;

  if (leftWord && rightWord) {
    const missingCount = rightIndex - leftIndex;
    const pos = tokenIndex - leftIndex;
    const gapTime = Math.max(0.1, rightWord.start - leftWord.end);
    const step = gapTime / missingCount;
    const start = leftWord.end + step * (pos - 1);
    const duration = Math.max(0.1, step * 0.85);

    return {
      start: Math.max(0, start),
      end: start + duration,
      confidence: 0.4,
      source: "interpolated"
    };
  }

  if (leftWord) {
    const offset = (tokenIndex - leftIndex) * 0.25;
    const start = leftWord.end + offset;
    return {
      start: Math.max(0, start),
      end: start + 0.2,
      confidence: 0.3,
      source: "interpolated"
    };
  }

  if (rightWord) {
    const offset = (rightIndex - tokenIndex) * 0.25;
    const start = Math.max(0, rightWord.start - offset);
    return {
      start,
      end: start + 0.2,
      confidence: 0.3,
      source: "interpolated"
    };
  }

  const start = tokenIndex * 0.3;
  return {
    start,
    end: start + 0.25,
    confidence: 0.1,
    source: "interpolated"
  };
}

export function alignLyricsToWords(
  rawLyrics: string,
  whisperWords: GroqWord[],
  beats: number[] = []
): LyricSegment[] {
  const lines = rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("No lyric lines provided for alignment.");
  if (!whisperWords.length) throw new Error("No whisper transcription words provided for alignment.");

  const lyricTokens = tokenizeLyrics(lines);
  const rawMapping = globalDPAlign(lyricTokens, whisperWords);

  const segments: LyricSegment[] = [];

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const lineText = lines[lIdx];
    const lineTokenIndices = lyricTokens
      .map((t, idx) => ({ token: t, idx }))
      .filter(({ token }) => token.lineIndex === lIdx);

    const timedWords: TimedWord[] = [];
    let lastTime = 0;

    for (const { token, idx } of lineTokenIndices) {
      const timing = interpolateTimestamps(idx, rawMapping, whisperWords);
      const start = Math.max(lastTime, timing.start);
      const end = Math.max(start + 0.05, timing.end);
      lastTime = end;

      timedWords.push({
        id: crypto.randomUUID(),
        text: token.original,
        normalized: token.normalized,
        start,
        end,
        confidence: timing.confidence,
        source: timing.source
      });
    }

    const segStart =
      timedWords.length > 0
        ? Math.max(0, Math.min(...timedWords.map((w) => w.start)) - 0.05)
        : 0;

    const segEnd =
      timedWords.length > 0
        ? Math.max(...timedWords.map((w) => w.end)) + 0.1
        : segStart + 1;

    const avgConfidence =
      timedWords.length > 0
        ? timedWords.reduce((acc, w) => acc + w.confidence, 0) / timedWords.length
        : 0;

    const duration = segEnd - segStart;
    const beatNearStart = beats.some((b) => Math.abs(b - segStart) < 0.1);
    const autoAnim = chooseAutoAnimation({
      text: lineText,
      duration,
      alignmentConfidence: avgConfidence,
      beatNearStart
    });

    segments.push({
      id: crypto.randomUUID(),
      lineIndex: lIdx,
      text: lineText,
      start: segStart,
      end: Math.max(segStart + 0.2, segEnd),
      words: timedWords,
      alignmentConfidence: avgConfidence,
      needsReview: avgConfidence < 0.5,
      animationMode: "auto",
      animation: autoAnim,
      animationIntensity: 1.0
    });
  }

  for (let s = 1; s < segments.length; s++) {
    if (segments[s].start < segments[s - 1].start) {
      segments[s].start = segments[s - 1].start + 0.1;
      if (segments[s].end <= segments[s].start) {
        segments[s].end = segments[s].start + 1.0;
      }
    }
  }

  return segments;
}
