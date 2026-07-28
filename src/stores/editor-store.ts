import type { AnimationMode, AnimationName, EditorProject, LyricSegment, TextStyle } from "@/lib/editor-schema";
import { create } from "zustand";

type GenerationState = {
  activeRequestId: string | null;
  status: "idle" | "pending" | "success" | "error" | "cancelled";
  error: string | null;
};

type EditorState = {
  project: EditorProject | null;
  currentTime: number;
  isPlaying: boolean;
  selectedSegmentId: string | null;
  generation: GenerationState;
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
  nudgeSegment: (id: string, deltaSeconds: number) => void;
  splitSegment: (id: string, splitTime: number) => void;
  mergeSegments: (firstId: string, secondId: string) => void;
  deleteSegment: (id: string) => void;
  realignSegment: (id: string) => void;

  setKaraokeEnabled: (enabled: boolean) => void;
  setSegmentKaraokeOverride: (id: string, override?: boolean) => void;
  updateTextStyle: (patch: Partial<TextStyle>) => void;
  setSegmentAnimationMode: (id: string, mode: AnimationMode) => void;
  setSegmentAnimation: (id: string, animation: AnimationName) => void;
  setAllAnimations: (animation: AnimationName) => void;

  // Generation state tracking
  beginGeneration: (requestId: string) => void;
  applyAnimationSuggestions: (
    requestId: string,
    suggestions: Array<{ segmentId: string; animation: AnimationName; intensity: number }>
  ) => void;
  failGeneration: (requestId: string, error: string) => void;
  cancelGeneration: () => void;

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
  generation: {
    activeRequestId: null,
    status: "idle",
    error: null
  },
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

    updatedSegments.sort((a, b) => a.start - b.start);

    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set(pushHistory(get(), newProject));
  },

  nudgeSegment: (id, deltaSeconds) => {
    const { project } = get();
    if (!project) return;

    const seg = project.segments.find((s) => s.id === id);
    if (!seg) return;

    const newStart = Math.max(0, seg.start + deltaSeconds);
    const newEnd = Math.max(newStart + 0.2, seg.end + deltaSeconds);

    get().updateSegmentTime(id, newStart, newEnd);
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
      lineIndex: seg.lineIndex,
      text: firstWords.map((w) => w.text).join(" ") || seg.text.slice(0, Math.floor(seg.text.length / 2)),
      end: splitTime,
      words: firstWords
    };

    const secondSeg: LyricSegment = {
      ...seg,
      id: crypto.randomUUID(),
      lineIndex: seg.lineIndex + 1,
      text: secondWords.map((w) => w.text).join(" ") || seg.text.slice(Math.floor(seg.text.length / 2)),
      start: splitTime,
      words: secondWords
    };

    const newSegments = [...project.segments];
    newSegments.splice(targetIdx, 1, firstSeg, secondSeg);

    // Re-index remaining lines
    newSegments.forEach((s, idx) => {
      s.lineIndex = idx;
    });

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
      text: `${first.text} ${second.text}`,
      end: Math.max(first.end, second.end),
      words: [...first.words, ...second.words].sort((a, b) => a.start - b.start)
    };

    const newSegments = project.segments.filter((s) => s.id !== firstId && s.id !== secondId);
    newSegments.push(mergedSeg);
    newSegments.sort((a, b) => a.start - b.start);

    newSegments.forEach((s, idx) => {
      s.lineIndex = idx;
    });

    const newProject: EditorProject = { ...project, segments: newSegments };
    set(pushHistory(get(), newProject));
  },

  deleteSegment: (id) => {
    const { project } = get();
    if (!project) return;

    const newSegments = project.segments.filter((s) => s.id !== id);
    newSegments.forEach((s, idx) => {
      s.lineIndex = idx;
    });

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

  setKaraokeEnabled: (enabled) => {
    const { project } = get();
    if (!project) return;

    const newProject: EditorProject = { ...project, karaokeEnabled: enabled };
    set(pushHistory(get(), newProject));
  },

  setSegmentKaraokeOverride: (id, override) => {
    get().updateSegment(id, { karaokeOverride: override });
  },

  updateTextStyle: (patch) => {
    const { project } = get();
    if (!project) return;

    const newTextStyle: TextStyle = { ...project.textStyle, ...patch };
    const newProject: EditorProject = { ...project, textStyle: newTextStyle };
    set(pushHistory(get(), newProject));
  },

  setSegmentAnimationMode: (id, mode) => {
    get().updateSegment(id, { animationMode: mode });
  },

  setSegmentAnimation: (id, animation) => {
    get().updateSegment(id, { animation, animationMode: "manual" });
  },

  setAllAnimations: (animation) => {
    const { project } = get();
    if (!project) return;

    const updatedSegments = project.segments.map((s) => ({ ...s, animation, animationMode: "manual" as const }));
    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set(pushHistory(get(), newProject));
  },

  beginGeneration: (requestId) => {
    set({
      generation: {
        activeRequestId: requestId,
        status: "pending",
        error: null
      }
    });
  },

  applyAnimationSuggestions: (requestId, suggestions) => {
    const { project, generation } = get();
    if (!project || generation.activeRequestId !== requestId) return;

    const sugMap = new Map(suggestions.map((s) => [s.segmentId, s]));

    const updatedSegments = project.segments.map((seg) => {
      // Don't overwrite manual choices
      if (seg.animationMode === "manual") return seg;

      const sug = sugMap.get(seg.id);
      if (sug) {
        return {
          ...seg,
          animationMode: "ai" as const,
          animation: sug.animation,
          animationIntensity: sug.intensity
        };
      }
      return seg;
    });

    const newProject: EditorProject = { ...project, segments: updatedSegments };
    set({
      generation: { activeRequestId: null, status: "success", error: null },
      ...pushHistory(get(), newProject)
    });
  },

  failGeneration: (requestId, error) => {
    const { generation } = get();
    if (generation.activeRequestId !== requestId) return;
    set({
      generation: { activeRequestId: null, status: "error", error }
    });
  },

  cancelGeneration: () => {
    set({
      generation: { activeRequestId: null, status: "cancelled", error: null }
    });
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
