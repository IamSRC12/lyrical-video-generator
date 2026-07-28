"use client";

import { useEditorStore } from "@/stores/editor-store";
import { ArrowLeft, Play, Pause, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import { LeftPanel } from "./LeftPanel";
import { PreviewCanvas } from "./PreviewCanvas";
import { Timeline } from "./Timeline";
import { Waveform } from "./Waveform";

export function EditorWorkspace() {
  const project = useEditorStore((s) => s.project);
  const setProject = useEditorStore((s) => s.setProject);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  if (!project) return null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Top Navigation Bar */}
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProject(null as any)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>New Project</span>
          </button>
          <span className="h-4 w-px bg-zinc-800" />
          <h1 className="text-sm font-bold text-white truncate max-w-xs">{project.title}</h1>
        </div>

        {/* Global Playback & History Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              title="Undo"
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={redo}
              title="Redo"
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={togglePlay}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-4 py-1.5 text-xs font-bold text-zinc-950 shadow-md shadow-yellow-500/20 hover:brightness-110"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-zinc-950" /> : <Play className="h-4 w-4 fill-zinc-950" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>

          <div className="flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-1 font-mono text-xs text-yellow-400 border border-zinc-850">
            <span>{currentTime.toFixed(2)}s</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{project.duration.toFixed(2)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Volume2 className="h-4 w-4 text-zinc-500" />
          <span>{project.fps} FPS</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />

        <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
          <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-zinc-950/80">
            <PreviewCanvas />
          </div>

          <div className="h-72 border-t border-zinc-800 bg-zinc-900/50 flex flex-col shrink-0">
            <Waveform />
            <Timeline />
          </div>
        </div>
      </div>
    </div>
  );
}
