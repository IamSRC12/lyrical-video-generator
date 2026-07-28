const SECTION_NAMES = new Set(
  [
    // English
    "lyrics",
    "lyric",
    "intro",
    "introduction",
    "verse",
    "prechorus",
    "chorus",
    "refrain",
    "hook",
    "bridge",
    "break",
    "breakdown",
    "interlude",
    "outro",
    "ending",
    "instrumental",
    "solo",
    "repeat",
    "spoken",
    "rap",

    // Spanish / Portuguese
    "letra",
    "letras",
    "introduccion",
    "introducao",
    "verso",
    "estrofa",
    "coro",
    "refrao",
    "refran",
    "puente",
    "ponte",
    "final",

    // French / Italian / German
    "paroles",
    "couplet",
    "refrain",
    "pont",
    "strofa",
    "ritornello",
    "strophe",
    "refrain",
    "brucke",

    // Common romanized labels
    "mukhda",
    "antara",
    "sargam",
    "alap",
    "alaap"
  ].map(normalizeLabel)
);

const METADATA_NAMES = new Set(
  [
    "artist",
    "singer",
    "song",
    "title",
    "album",
    "composer",
    "writer",
    "writtenby",
    "performedby",
    "producedby"
  ].map(normalizeLabel)
);

function normalizeLabel(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/\d+/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");
}

function stripLrcTimestamps(line: string): string {
  return line.replace(
    /^\s*(?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*)+/u,
    ""
  );
}

function isStructuralHeading(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) return true;

  // Removes [Verse], [Intro 2], 【Chorus】 etc. in any writing system.
  if (
    /^(?:\[|【).{1,80}(?:\]|】)$/u.test(trimmed) &&
    !/\d{1,2}:\d{2}/.test(trimmed)
  ) {
    return true;
  }

  // "Verse:", "Chorus 2:", or equivalent unknown-language labels.
  if (/^.{1,50}[:：]$/u.test(trimmed)) {
    return true;
  }

  const normalized = normalizeLabel(trimmed);

  if (SECTION_NAMES.has(normalized)) return true;

  // Matches Verse 1, Chorus 2, Intro II, etc.
  for (const name of SECTION_NAMES) {
    if (
      normalized.startsWith(name) &&
      normalized.slice(name.length).length <= 4
    ) {
      return true;
    }
  }

  const metadataMatch = /^(.{1,30})[:：]\s*(.+)$/u.exec(trimmed);

  if (
    metadataMatch &&
    METADATA_NAMES.has(normalizeLabel(metadataMatch[1]))
  ) {
    return true;
  }

  return false;
}

export type CleanLyricsResult = {
  text: string;
  lines: string[];
  removedLines: string[];
};

export function cleanLyrics(rawLyrics: string): CleanLyricsResult {
  const kept: string[] = [];
  const removed: string[] = [];

  for (const rawLine of rawLyrics.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = stripLrcTimestamps(rawLine).trim();

    if (!line) continue;

    if (isStructuralHeading(line)) {
      removed.push(line);
    } else {
      kept.push(line);
    }
  }

  if (!kept.length) {
    throw new Error(
      "No lyric lines remained after removing section headings."
    );
  }

  return {
    text: kept.join("\n"),
    lines: kept,
    removedLines: removed
  };
}
