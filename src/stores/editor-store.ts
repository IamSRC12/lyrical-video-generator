"use client";

import {create} from "zustand";
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
  setAnimation: (id: string, animation: AnimationName) => void;
  setSegments: (segments: LyricSegment[]) => void;
  setBackground: (url?: string) => void;
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

export const useEditorStore = create<EditorState>((set) => ({
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
}));

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
