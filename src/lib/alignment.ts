import type {GroqWord} from "@/services/groq";
import type {LyricSegment, TimedWord} from "./editor-schema";

type LyricToken = {
  original: string;
  normalized: string;
  lineIndex: number;
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

function estimateTokenTime(
  tokenIndex: number,
  mapping: Array<number | null>,
  words: GroqWord[]
): {start: number; end: number} {
  const mapped = mapping[tokenIndex];

  if (mapped !== null) {
    return {
      start: words[mapped].start,
      end: words[mapped].end
    };
  }

  let previousToken = tokenIndex - 1;
  let nextToken = tokenIndex + 1;

  while (previousToken >= 0 && mapping[previousToken] === null) {
    previousToken--;
  }

  while (nextToken < mapping.length && mapping[nextToken] === null) {
    nextToken++;
  }

  const previousWord =
    previousToken >= 0 && mapping[previousToken] !== null
      ? words[mapping[previousToken]!]
      : undefined;

  const nextWord =
    nextToken < mapping.length && mapping[nextToken] !== null
      ? words[mapping[nextToken]!]
      : undefined;

  if (previousWord && nextWord) {
    const missingCount = nextToken - previousToken;
    const position = tokenIndex - previousToken;
    const step = (nextWord.start - previousWord.end) / missingCount;
    const start = previousWord.end + step * (position - 1);

    return {
      start,
      end: Math.max(start + 0.08, start + Math.max(step * 0.8, 0.08))
    };
  }

  if (previousWord) {
    const start = previousWord.end + 0.05 * (tokenIndex - previousToken);
    return {start, end: start + 0.16};
  }

  if (nextWord) {
    const distance = nextToken - tokenIndex;
    const end = Math.max(0.1, nextWord.start - 0.05 * distance);
    return {start: Math.max(0, end - 0.16), end};
  }

  const start = tokenIndex * 0.25;
  return {start, end: start + 0.2};
}

export function alignLyricsToWords(
  rawLyrics: string,
  whisperWords: GroqWord[]
): LyricSegment[] {
  const lines = rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) throw new Error("No lyric lines were provided.");
  if (!whisperWords.length) throw new Error("No timed words were returned.");

  const lyricTokens = tokenizeLyrics(lines);
  const mapping = globalAlign(lyricTokens, whisperWords);

  return lines.map((line, lineIndex) => {
    const indexedTokens = lyricTokens
      .map((token, index) => ({token, index}))
      .filter(({token}) => token.lineIndex === lineIndex);

    const words: TimedWord[] = indexedTokens.map(({token, index}) => ({
      word: token.original,
      ...estimateTokenTime(index, mapping, whisperWords)
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
      animation: lineIndex % 3 === 0 ? "pop" : "fade"
    };
  });
}
