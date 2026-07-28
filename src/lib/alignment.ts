import type {GroqWord} from "@/services/groq";
import type {AnimationName, LyricSegment, TimedWord} from "./editor-schema";

type LyricToken = {
  original: string;
  normalized: string;
  lineIndex: number;
};

type TokenTime = {
  start: number;
  end: number;
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\p{Letter}\p{Number}']/gu, "");
}

function tokenizeLyrics(lines: string[]): LyricToken[] {
  return lines.flatMap((line, lineIndex) =>
    line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((original) => ({
        original,
        normalized: normalize(original),
        lineIndex
      }))
  );
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({length: b.length + 1}, (_, index) => index);

  for (let row = 1; row <= a.length; row++) {
    const current = [row];

    for (let column = 1; column <= b.length; column++) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] +
          (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }

    previous = current;
  }

  return previous[b.length];
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;

  const maxLength = Math.max(a.length, b.length, 1);
  const ratio = levenshtein(a, b) / maxLength;

  if (ratio <= 0.2) return 0.2;
  if (ratio <= 0.4) return 0.55;
  return 1.35;
}

/**
 * Returns one Whisper-word index per lyric token.
 * null means that the lyric token had no reliable transcription counterpart.
 */
function globalAlign(
  lyricTokens: LyricToken[],
  whisperWords: GroqWord[]
): Array<number | null> {
  const n = lyricTokens.length;
  const m = whisperWords.length;
  const gapLyric = 0.9;
  const gapWhisper = 0.65;

  const scores = Array.from({length: n + 1}, () =>
    Array<number>(m + 1).fill(0)
  );

  const moves = Array.from({length: n + 1}, () =>
    Array<"diag" | "up" | "left" | null>(m + 1).fill(null)
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
    for (let j = 1; j <= m; j++) {
      const diagonal =
        scores[i - 1][j - 1] +
        substitutionCost(
          lyricTokens[i - 1].normalized,
          normalize(whisperWords[j - 1].word)
        );

      const up = scores[i - 1][j] + gapLyric;
      const left = scores[i][j - 1] + gapWhisper;
      const minimum = Math.min(diagonal, up, left);

      scores[i][j] = minimum;
      moves[i][j] =
        minimum === diagonal ? "diag" : minimum === up ? "up" : "left";
    }
  }

  const mapping: Array<number | null> = Array(n).fill(null);

  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    const move = moves[i][j];

    if (move === "diag") {
      const cost = substitutionCost(
        lyricTokens[i - 1].normalized,
        normalize(whisperWords[j - 1].word)
      );

      if (cost <= 0.9) mapping[i - 1] = j - 1;

      i--;
      j--;
    } else if (move === "up") {
      i--;
    } else {
      j--;
    }
  }

  return mapping;
}

function estimateAllTokenTimes(
  mapping: Array<number | null>,
  words: GroqWord[],
  audioDuration: number
): TokenTime[] {
  const result: Array<TokenTime | null> = mapping.map((mappedIndex) => {
    if (mappedIndex === null) return null;

    const word = words[mappedIndex];

    return {
      start: Math.max(0, word.start),
      end: Math.max(word.start + 0.02, word.end)
    };
  });

  let cursor = 0;

  while (cursor < result.length) {
    if (result[cursor]) {
      cursor++;
      continue;
    }

    const runStart = cursor;

    while (cursor < result.length && result[cursor] === null) {
      cursor++;
    }

    const runEnd = cursor;
    const count = runEnd - runStart;

    const previous =
      runStart > 0 ? result[runStart - 1] : null;

    const next =
      runEnd < result.length ? result[runEnd] : null;

    let leftBoundary = previous?.end ?? 0;
    let rightBoundary = next?.start ?? audioDuration;

    if (!Number.isFinite(rightBoundary) || rightBoundary <= leftBoundary) {
      rightBoundary = leftBoundary + count * 0.18;
    }

    const available = Math.max(
      count * 0.03,
      rightBoundary - leftBoundary
    );

    const slotDuration = available / count;

    for (let index = 0; index < count; index++) {
      const start = leftBoundary + slotDuration * index;
      const end = Math.min(
        rightBoundary,
        start + Math.max(0.03, slotDuration * 0.82)
      );

      result[runStart + index] = {
        start,
        end: Math.max(start + 0.02, end)
      };
    }
  }

  return result.map(
    (time, index) =>
      time ?? {
        start: (index / Math.max(1, result.length)) * audioDuration,
        end:
          ((index + 0.8) / Math.max(1, result.length)) *
          audioDuration
      }
  );
}

export function alignLyricsToWords(
  rawLyrics: string,
  whisperWords: GroqWord[],
  suppliedDuration?: number
): LyricSegment[] {
  const validWords = whisperWords
    .filter(
      (word) =>
        word.word.trim() &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.start >= 0 &&
        word.end >= word.start
    )
    .sort((a, b) => a.start - b.start);

  if (!validWords.length) {
    throw new Error("No valid timed words were returned.");
  }

  const audioDuration = Math.max(
    suppliedDuration ?? 0,
    validWords.at(-1)?.end ?? 0,
    1
  );

  const lines = rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("No lyric lines were provided.");

  const lyricTokens = tokenizeLyrics(lines);
  const mapping = globalAlign(lyricTokens, validWords);
  const tokenTimes = estimateAllTokenTimes(
    mapping,
    validWords,
    audioDuration
  );

  const segments = lines.map((line, lineIndex) => {
    const indexedTokens = lyricTokens
      .map((token, index) => ({token, index}))
      .filter(({token}) => token.lineIndex === lineIndex);

    const words: TimedWord[] = indexedTokens.map(({token, index}) => ({
      word: token.original,
      ...tokenTimes[index]
    }));

    const start =
      words.length > 0
        ? Math.max(0, Math.min(...words.map((word) => word.start)) - 0.04)
        : 0;

    const end =
      words.length > 0
        ? Math.max(...words.map((word) => word.end)) + 0.08
        : start + 1;

    return {
      id: crypto.randomUUID(),
      line,
      start,
      end: Math.max(start + 0.1, end),
      words,
      animation: (lineIndex % 3 === 0 ? "pop" : "fade") as AnimationName,
      confidence: 1,
      source: "provided" as const
    };
  });

  segments.sort((a, b) => a.start - b.start);

  for (let index = 0; index < segments.length - 1; index++) {
    const current = segments[index];
    const next = segments[index + 1];

    current.end = Math.min(
      Math.max(current.start + 0.1, current.end),
      Math.max(current.start + 0.1, next.start - 0.01)
    );
  }

  return segments;
}
