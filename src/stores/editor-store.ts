"use client";

import {create} from "zustand";
import {persist, createJSONStorage} from "zustand/middleware";
import type {
  AnimationName,
  EditorProject,
  LyricSegment
} from "@/lib/editor-schema";
import {defaultTextStyle} from "@/lib/editor-schema";

type EditorState = {
  project: EditorProject | null;
  playhead: number;
  selectedSegmentId: string | null;
  isExporting: boolean;
  exportProgress: number;

  loadProject: (project: EditorProject) => void;
  setPlayhead: (seconds: number) => void;
  selectSegment: (id: string | null) => void;
  moveSegment: (id: string, start: number, end: number) => void;
  shiftSegment: (id: string, delta: number) => void;
  shiftAllAfter: (id: string, delta: number) => void;
  setSegmentStartFromPlayhead: (id: string) => void;
  setSegmentEndFromPlayhead: (id: string) => void;
  setAnimation: (id: string, animation: AnimationName) => void;
  setSegments: (segments: LyricSegment[]) => void;
  setBackground: (url?: string) => void;
  setAudioUrl: (url: string) => void;
  replaceAudioUrl: (audioUrl: string) => void;
  patchTextStyle: (
    patch: Partial<EditorProject["textStyle"]>
  ) => void;
  setToggle: (
    key: keyof EditorProject["toggles"],
    value: boolean
  ) => void;
  setResolution: (quality: "720p" | "1080p") => void;
  setExportState: (isExporting: boolean, progress?: number) => void;
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      project: null,
      playhead: 0,
      selectedSegmentId: null,
      isExporting: false,
      exportProgress: 0,

      loadProject: (project) =>
        set({
          project,
          playhead: 0,
          selectedSegmentId: project.segments[0]?.id ?? null
        }),

      setPlayhead: (playhead) => set({playhead}),

      selectSegment: (selectedSegmentId) => set({selectedSegmentId}),

      moveSegment: (id, start, end) =>
        set((state) => {
          if (!state.project) return state;

          const old = state.project.segments.find((segment) => segment.id === id);
          if (!old) return state;

          const safeStart = Math.max(0, start);
          const safeEnd = Math.max(safeStart + 0.1, end);
          const offset = safeStart - old.start;

          return {
            project: {
              ...state.project,
              segments: state.project.segments.map((segment) =>
                segment.id === id
                  ? {
                      ...segment,
                      start: safeStart,
                      end: safeEnd,
                      words: segment.words.map((word) => ({
                        ...word,
                        start: Math.max(0, word.start + offset),
                        end: Math.max(0.01, word.end + offset)
                      }))
                    }
                  : segment
              )
            }
          };
        }),

      shiftSegment: (id, delta) =>
        set((state) => {
          if (!state.project) return state;
          const seg = state.project.segments.find((s) => s.id === id);
          if (!seg) return state;
          const newStart = Math.max(0, seg.start + delta);
          const duration = seg.end - seg.start;
          return get().moveSegment(id, newStart, newStart + duration) as any;
        }),

      shiftAllAfter: (id, delta) =>
        set((state) => {
          if (!state.project) return state;
          const targetIndex = state.project.segments.findIndex((s) => s.id === id);
          if (targetIndex === -1) return state;

          return {
            project: {
              ...state.project,
              segments: state.project.segments.map((segment, index) => {
                if (index < targetIndex) return segment;
                const newStart = Math.max(0, segment.start + delta);
                const duration = segment.end - segment.start;
                const offset = newStart - segment.start;
                return {
                  ...segment,
                  start: newStart,
                  end: Math.max(newStart + 0.1, segment.end + delta),
                  words: segment.words.map((w) => ({
                    ...w,
                    start: Math.max(0, w.start + offset),
                    end: Math.max(0.01, w.end + offset)
                  }))
                };
              })
            }
          };
        }),

      setSegmentStartFromPlayhead: (id) =>
        set((state) => {
          if (!state.project) return state;
          const seg = state.project.segments.find((s) => s.id === id);
          if (!seg) return state;
          const playhead = state.playhead;
          const newStart = Math.max(0, playhead);
          const duration = Math.max(0.1, seg.end - seg.start);
          return get().moveSegment(id, newStart, newStart + duration) as any;
        }),

      setSegmentEndFromPlayhead: (id) =>
        set((state) => {
          if (!state.project) return state;
          const seg = state.project.segments.find((s) => s.id === id);
          if (!seg) return state;
          const playhead = state.playhead;
          const newEnd = Math.max(seg.start + 0.1, playhead);
          return {
            project: {
              ...state.project,
              segments: state.project.segments.map((s) =>
                s.id === id ? {...s, end: newEnd} : s
              )
            }
          };
        }),

      setAnimation: (id, animation) =>
        set((state) => {
          if (!state.project) return state;

          return {
            project: {
              ...state.project,
              segments: state.project.segments.map((segment) =>
                segment.id === id ? {...segment, animation} : segment
              )
            }
          };
        }),

      setSegments: (segments) =>
        set((state) =>
          state.project
            ? {project: {...state.project, segments}}
            : state
        ),

      setBackground: (backgroundUrl) =>
        set((state) =>
          state.project
            ? {project: {...state.project, backgroundUrl}}
            : state
        ),

      setAudioUrl: (audioUrl) =>
        set((state) =>
          state.project
            ? {project: {...state.project, audioUrl}}
            : state
        ),

      patchTextStyle: (patch) =>
        set((state) =>
          state.project
            ? {
                project: {
                  ...state.project,
                  textStyle: {...state.project.textStyle, ...patch}
                }
              }
            : state
        ),

      setToggle: (key, value) =>
        set((state) =>
          state.project
            ? {
                project: {
                  ...state.project,
                  toggles: {...state.project.toggles, [key]: value}
                }
              }
            : state
        ),

      setResolution: (quality) =>
        set((state) =>
          state.project
            ? {
                project: {
                  ...state.project,
                  width: quality === "1080p" ? 1920 : 1280,
                  height: quality === "1080p" ? 1080 : 720
                }
              }
            : state
        ),

      setExportState: (isExporting, exportProgress = 0) =>
        set({isExporting, exportProgress})
    }),
    {
      name: "lyrical-project-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        project: state.project,
        selectedSegmentId: state.selectedSegmentId
      })
    }
  )
);

export function createProject(input: {
  audioUrl: string;
  duration: number;
  segments: LyricSegment[];
  beats?: number[];
}): EditorProject {
  return {
    version: 1,
    title: "Untitled lyrical video",
    fps: 30,
    width: 1920,
    height: 1080,
    duration: input.duration,
    audioUrl: input.audioUrl,
    backgroundColor: "#111827",
    segments: input.segments,
    beats: input.beats ?? [],
    textStyle: {...defaultTextStyle},
    toggles: {
      beatSync: false,
      contextualAnimations: false,
      karaokeHighlight: true
    }
  };
}
