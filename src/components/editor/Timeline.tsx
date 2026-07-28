"use client";

import type { LyricSegment } from "@/lib/editor-schema";
import { useEditorStore } from "@/stores/editor-store";
import { ChevronLeft, ChevronRight, Scissors, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function Timeline() {
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const selectSegment = useEditorStore((s) => s.selectSegment);

  const updateSegmentTime = useEditorStore((s) => s.updateSegmentTime);
  const nudgeSegment = useEditorStore((s) => s.nudgeSegment);
  const splitSegment = useEditorStore((s) => s.splitSegment);
  const deleteSegment = useEditorStore((s) => s.deleteSegment);
  const realignSegment = useEditorStore((s) => s.realignSegment);

  const timelineRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState<{
    segmentId: string;
    type: "move" | "resize-left" | "resize-right";
    initialX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  if (!project) return null;

  const duration = project.duration || 10;
  const fps = 60; // Mandatory 60 FPS

  const getSnapTime = useCallback(
    (targetTime: number, excludeId: string): number => {
      const snapThreshold = 0.12;
      let bestSnap = targetTime;
      let minDiff = snapThreshold;

      const frameDuration = 1 / fps;
      const frameTime = Math.round(targetTime / frameDuration) * frameDuration;
      if (Math.abs(frameTime - targetTime) < minDiff) {
        minDiff = Math.abs(frameTime - targetTime);
        bestSnap = frameTime;
      }

      for (const beat of project.beats || []) {
        const diff = Math.abs(beat - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          bestSnap = beat;
        }
      }

      for (const seg of project.segments) {
        if (seg.id === excludeId) continue;

        const startDiff = Math.abs(seg.start - targetTime);
        if (startDiff < minDiff) {
          minDiff = startDiff;
          bestSnap = seg.start;
        }

        const endDiff = Math.abs(seg.end - targetTime);
        if (endDiff < minDiff) {
          minDiff = endDiff;
          bestSnap = seg.end;
        }
      }

      return bestSnap;
    },
    [fps, project.beats, project.segments]
  );

  const handlePointerDown = (
    e: React.PointerEvent,
    segment: LyricSegment,
    type: "move" | "resize-left" | "resize-right"
  ) => {
    e.stopPropagation();
    selectSegment(segment.id);

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setDragging({
      segmentId: segment.id,
      type,
      initialX: e.clientX,
      initialStart: segment.start,
      initialEnd: segment.end
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragging.initialX;
    const deltaTime = (deltaX / rect.width) * duration;

    if (dragging.type === "move") {
      const segDuration = dragging.initialEnd - dragging.initialStart;
      let newStart = Math.max(0, dragging.initialStart + deltaTime);
      newStart = getSnapTime(newStart, dragging.segmentId);
      const newEnd = newStart + segDuration;

      updateSegmentTime(dragging.segmentId, newStart, newEnd);
    } else if (dragging.type === "resize-left") {
      let newStart = Math.max(0, dragging.initialStart + deltaTime);
      newStart = getSnapTime(newStart, dragging.segmentId);
      if (dragging.initialEnd - newStart >= 0.2) {
        updateSegmentTime(dragging.segmentId, newStart, dragging.initialEnd);
      }
    } else if (dragging.type === "resize-right") {
      let newEnd = Math.min(duration, dragging.initialEnd + deltaTime);
      newEnd = getSnapTime(newEnd, dragging.segmentId);
      if (newEnd - dragging.initialStart >= 0.2) {
        updateSegmentTime(dragging.segmentId, dragging.initialStart, newEnd);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore pointer release errors
      }
      setDragging(null);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = (clickX / rect.width) * duration;
    setCurrentTime(time);
  };

  const selectedSeg = project.segments.find((s) => s.id === selectedSegmentId);

  // Keyboard shortcut listener for fine-sync nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedSegmentId) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const step = e.shiftKey ? -0.05 : -0.01;
        nudgeSegment(selectedSegmentId, step);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.01;
        nudgeSegment(selectedSegmentId, step);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nudgeSegment, selectedSegmentId]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950 p-2 border-t border-zinc-800/60">
      {/* Segment Action & Fine Sync Toolbar */}
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-2">
          {selectedSeg ? (
            <>
              {/* Fine Sync Nudge Control Buttons */}
              <div className="flex items-center gap-1 border-r border-zinc-800 pr-2 mr-1">
                <span className="text-[11px] text-zinc-500 mr-1 font-semibold">Fine Sync:</span>
                <button
                  onClick={() => nudgeSegment(selectedSeg.id, -0.05)}
                  className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white font-mono"
                  title="Nudge -50ms"
                >
                  -50ms
                </button>
                <button
                  onClick={() => nudgeSegment(selectedSeg.id, -0.01)}
                  className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white font-mono flex items-center"
                  title="Nudge -10ms"
                >
                  <ChevronLeft className="h-3 w-3" /> -10ms
                </button>
                <button
                  onClick={() => nudgeSegment(selectedSeg.id, 0.01)}
                  className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white font-mono flex items-center"
                  title="Nudge +10ms"
                >
                  +10ms <ChevronRight className="h-3 w-3" />
                </button>
                <button
                  onClick={() => nudgeSegment(selectedSeg.id, 0.05)}
                  className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-white font-mono"
                  title="Nudge +50ms"
                >
                  +50ms
                </button>
              </div>

              <button
                onClick={() => splitSegment(selectedSeg.id, currentTime)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-yellow-500/50 hover:text-white"
              >
                <Scissors className="h-3.5 w-3.5 text-yellow-400" />
                <span>Split at Playhead</span>
              </button>

              <button
                onClick={() => realignSegment(selectedSeg.id)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-yellow-500/50 hover:text-white"
              >
                <Wand2 className="h-3.5 w-3.5 text-yellow-400" />
                <span>Re-align</span>
              </button>

              <button
                onClick={() => deleteSegment(selectedSeg.id)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </>
          ) : (
            <span className="text-xs text-zinc-500">Select a lyric block to enable Fine Sync (Nudge ±10ms/50ms with Arrow keys)</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
          <span className="text-yellow-400 font-semibold">60 FPS Mode</span>
        </div>
      </div>

      {/* Track Workspace */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden cursor-crosshair"
      >
        {/* Playhead Marker Line */}
        <div
          className="absolute top-0 bottom-0 z-30 w-0.5 bg-yellow-400 pointer-events-none"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        >
          <div className="h-3 w-3 -translate-x-[5px] rotate-45 rounded-sm bg-yellow-400 shadow-md" />
        </div>

        {/* Lyric Segment Blocks */}
        {project.segments.map((seg) => {
          const leftPercent = (seg.start / duration) * 100;
          const widthPercent = Math.max(0.5, ((seg.end - seg.start) / duration) * 100);
          const isSelected = seg.id === selectedSegmentId;

          return (
            <div
              key={seg.id}
              onPointerDown={(e) => handlePointerDown(e, seg, "move")}
              className={`absolute top-3 bottom-3 rounded-lg border text-xs flex items-center px-3 font-semibold transition-colors group cursor-grab active:cursor-grabbing overflow-hidden ${
                isSelected
                  ? "border-yellow-400 bg-yellow-500/25 text-yellow-200 shadow-lg shadow-yellow-500/10 z-20"
                  : seg.needsReview
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:border-amber-400 z-10"
                  : "border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:border-zinc-600 z-10"
              }`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <div
                onPointerDown={(e) => handlePointerDown(e, seg, "resize-left")}
                className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-zinc-700/50 hover:bg-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
              />

              <span className="truncate select-none">{seg.text}</span>

              <div
                onPointerDown={(e) => handlePointerDown(e, seg, "resize-right")}
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize bg-zinc-700/50 hover:bg-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
