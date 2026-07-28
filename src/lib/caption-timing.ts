
import type {LyricSegment} from "./editor-schema";

export function getActiveSegment(
  segments: LyricSegment[],
  time: number
): LyricSegment | undefined {
  let active: LyricSegment | undefined;

  for (const segment of segments) {
    if (time >= segment.start && time < segment.end) {
      if (!active || segment.start >= active.start) {
        active = segment;
      }
    }
  }

  return active;
}

export function getHighlightedWordIndex(
  segment: LyricSegment,
  time: number
): number {
  let result = -1;

  for (let index = 0; index < segment.words.length; index++) {
    if (time >= segment.words[index].start) {
      result = index;
    } else {
      break;
    }
  }

  return result;
}


