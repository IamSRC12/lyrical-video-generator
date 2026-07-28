import type { AnimationName, EditorProject, LyricSegment, TextStyle } from "@/lib/editor-schema";
import { create } from "zustand";

type EditorState = {
  project: EditorProject | null;
  currentTime: number;
  isPlaying: boolean;
  selectedSegmentId: string | null;
  history: EditorProject[];
  historyIndex: number;

  // Actions
  setProject: (project: EditorProject) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  selectSegment: (id: string | null) => void;

  updateSegment: (id: string, patch: Partial<LyricSegment>) => void;
  updateSegmentTime: (id: string, start: number, end: number) => void;
  splitSegment: (id: string, splitTime: number) => void;
  mergeSegments: (firstId: string, secondId: string) => void;
  deleteSegment: (id: string) => void;
  realignSegment: (id: string) => void;

  updateTextStyle: (patch: Partial<TextStyle>) => void;
  setSegmentAnimation: (id: string, animation: AnimationName) => void;
  setAllAnimations: (animation: AnimationName) => void;
  setProjectBackground: (url?: string, color?: string) => void;

  undo: () => void;
  redo: () => void;
};

const MAX_HISTORY = 30;

function pushHistory(state: EditorState, newProject: EditorProject): Partial<EditorState> {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(newProject)));

  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }

  return {
    project: newProject,
    history: newHistory,
    historyIndex: newHistory.length - 1
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  currentTime: 0,
  isPlaying: false,
  selectedSegmentId: null,
  history: [],
  historyIndex: -1,

  setProject: (project) => {
    const clone = JSON.parse(JSON.stringify(project));
    set({
      project: clone,
      currentTime: 0,
      isPlaying: false,
      selectedSegmentId: clone.segments[0]?.id || null,
      history: [clone],
      historyIndex: 0
    });
  },

  setCurrentTime: (time) => {
    const { project } = get();
    const duration = project?.duration || 0;
    const clamped = Math.max(0, Math.min(time, duration));
    set({ currentTime: clamped });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  selectSegment: (id) => set({ selectedSegmentId: id }),

  updateSegment: (id, patch) => {
    const { project } = get();
    if (!project) return;

    const updatedSegments = project.segments.map((seg) => {
      if (seg.id === id) {
        return { ...seg, ...patch };
      }
      return seg;
    });

    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set(pushHistory(get(), newProject));
  },

  updateSegmentTime: (id, start, end) => {
    const { project } = get();
    if (!project) return;

    const MIN_DURATION = 0.2;
    const validStart = Math.max(0, start);
    const validEnd = Math.max(validStart + MIN_DURATION, end);

    const updatedSegments = project.segments.map((seg) => {
      if (seg.id === id) {
        // Adjust word timestamps proportionally
        const oldDuration = Math.max(0.1, seg.end - seg.start);
        const newDuration = validEnd - validStart;
        const scale = newDuration / oldDuration;

        const updatedWords = seg.words.map((w) => {
          const relativeStart = w.start - seg.start;
          const relativeEnd = w.end - seg.start;
          return {
            ...w,
            start: validStart + relativeStart * scale,
            end: validStart + relativeEnd * scale
          };
        });

        return {
          ...seg,
          start: validStart,
          end: validEnd,
          words: updatedWords
        };
      }
      return seg;
    });

    // Sort segments monotonically by start time
    updatedSegments.sort((a, b) => a.start - b.start);

    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set(pushHistory(get(), newProject));
  },

  splitSegment: (id, splitTime) => {
    const { project } = get();
    if (!project) return;

    const targetIdx = project.segments.findIndex((s) => s.id === id);
    if (targetIdx === -1) return;

    const seg = project.segments[targetIdx];
    if (splitTime <= seg.start + 0.1 || splitTime >= seg.end - 0.1) return;

    const firstWords = seg.words.filter((w) => w.end <= splitTime);
    const secondWords = seg.words.filter((w) => w.start >= splitTime);

    const firstSeg: LyricSegment = {
      ...seg,
      id: crypto.randomUUID(),
      line: firstWords.map((w) => w.word).join(" ") || seg.line.slice(0, Math.floor(seg.line.length / 2)),
      end: splitTime,
      words: firstWords
    };

    const secondSeg: LyricSegment = {
      ...seg,
      id: crypto.randomUUID(),
      line: secondWords.map((w) => w.word).join(" ") || seg.line.slice(Math.floor(seg.line.length / 2)),
      start: splitTime,
      words: secondWords
    };

    const newSegments = [...project.segments];
    newSegments.splice(targetIdx, 1, firstSeg, secondSeg);

    const newProject: EditorProject = { ...project, segments: newSegments };
    set(pushHistory(get(), newProject));
  },

  mergeSegments: (firstId, secondId) => {
    const { project } = get();
    if (!project) return;

    const firstIdx = project.segments.findIndex((s) => s.id === firstId);
    const secondIdx = project.segments.findIndex((s) => s.id === secondId);
    if (firstIdx === -1 || secondIdx === -1) return;

    const first = project.segments[firstIdx];
    const second = project.segments[secondIdx];

    const mergedSeg: LyricSegment = {
      ...first,
      id: crypto.randomUUID(),
      line: `${first.line} ${second.line}`,
      end: Math.max(first.end, second.end),
      words: [...first.words, ...second.words].sort((a, b) => a.start - b.start)
    };

    const newSegments = project.segments.filter((s) => s.id !== firstId && s.id !== secondId);
    newSegments.push(mergedSeg);
    newSegments.sort((a, b) => a.start - b.start);

    const newProject: EditorProject = { ...project, segments: newSegments };
    set(pushHistory(get(), newProject));
  },

  deleteSegment: (id) => {
    const { project } = get();
    if (!project) return;

    const newSegments = project.segments.filter((s) => s.id !== id);
    const newProject: EditorProject = { ...project, segments: newSegments };
    set({ selectedSegmentId: null, ...pushHistory(get(), newProject) });
  },

  realignSegment: (id) => {
    const { project } = get();
    if (!project) return;

    const idx = project.segments.findIndex((s) => s.id === id);
    if (idx === -1) return;

    const seg = project.segments[idx];
    const prevSeg = project.segments[idx - 1];
    const nextSeg = project.segments[idx + 1];

    const minStart = prevSeg ? prevSeg.end + 0.05 : 0;
    const maxEnd = nextSeg ? nextSeg.start - 0.05 : project.duration;

    if (minStart >= maxEnd) return;

    const duration = Math.min(seg.end - seg.start, maxEnd - minStart);
    const newStart = minStart;
    const newEnd = minStart + duration;

    get().updateSegmentTime(id, newStart, newEnd);
  },

  updateTextStyle: (patch) => {
    const { project } = get();
    if (!project) return;

    const newTextStyle: TextStyle = { ...project.textStyle, ...patch };
    const newProject: EditorProject = { ...project, textStyle: newTextStyle };
    set(pushHistory(get(), newProject));
  },

  setSegmentAnimation: (id, animation) => {
    get().updateSegment(id, { animation });
  },

  setAllAnimations: (animation) => {
    const { project } = get();
    if (!project) return;

    const updatedSegments = project.segments.map((s) => ({ ...s, animation }));
    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set(pushHistory(get(), newProject));
  },

  setProjectBackground: (url, color) => {
    const { project } = get();
    if (!project) return;

    const newProject: EditorProject = {
      ...project,
      backgroundUrl: url ?? project.backgroundUrl,
      backgroundColor: color ?? project.backgroundColor
    };
    set(pushHistory(get(), newProject));
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        project: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        project: JSON.parse(JSON.stringify(history[newIndex])),
        historyIndex: newIndex
      });
    }
  }
}));
