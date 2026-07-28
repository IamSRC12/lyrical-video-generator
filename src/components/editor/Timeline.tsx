
"use client";

import {useCallback, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {Waveform} from "./Waveform";
import {cn} from "@/lib/cn";

const PIXELS_PER_SECOND = 80;
const TRACK_HEIGHT = 36;

export function Timeline() {
  const project = useEditorStore((s) => s.project);
  const playhead = useEditorStore((s) => s.playhead);
  const selectedSegmentId = useEditorStore((s) => s.selectedSegmentId);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const selectSegment = useEditorStore((s) => s.selectSegment);
  const moveSegment = useEditorStore((s) => s.moveSegment);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    startTime: number;
    endTime: number;
  } | null>(null);

  if (!project) return null;

  const totalWidth = Math.max(
    project.duration * PIXELS_PER_SECOND,
    800
  );

  // Time ruler ticks
  const ticks: number[] = [];
  for (let t = 0; t <= project.duration; t += 1) {
    ticks.push(t);
  }

  function timeToX(time: number): number {
    return time * PIXELS_PER_SECOND;
  }

  function xToTime(x: number): number {
    return Math.max(0, x / PIXELS_PER_SECOND);
  }

  function handleMouseDown(
    e: React.MouseEvent,
    segId: string,
    start: number,
    end: number
  ) {
    e.stopPropagation();
    selectSegment(segId);

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragging({
      id: segId,
      offsetX: e.clientX - rect.left,
      startTime: start,
      endTime: end
    });
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !scrollRef.current) return;

      const scrollRect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - scrollRect.left + scrollRef.current.scrollLeft;
      const newStart = xToTime(x - dragging.offsetX);
      const duration = dragging.endTime - dragging.startTime;

      moveSegment(dragging.id, newStart, newStart + duration);
    },
    [dragging, moveSegment]
  );

  function handleMouseUp() {
    setDragging(null);
  }

  function handleTimelineClick(e: React.MouseEvent) {
    if (!scrollRef.current) return;
    const scrollRect = scrollRef.current.getBoundingClientRect();
    const x =
      e.clientX - scrollRect.left + scrollRef.current.scrollLeft;
    setPlayhead(xToTime(x));
  }

  return (
    <div
      className="editor-timeline flex flex-col overflow-hidden border-t border-white/5 bg-surface-raised"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Waveform strip */}
      <div className="h-14 border-b border-white/5">
        <Waveform
          audioUrl={project.audioUrl}
          playhead={playhead}
          duration={project.duration}
          beats={project.toggles.beatSync ? project.beats : []}
          onSeek={setPlayhead}
        />
      </div>

      {/* Timeline tracks */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-x-auto overflow-y-hidden"
        onClick={handleTimelineClick}
      >
        <div
          className="relative"
          style={{
            width: totalWidth,
            minHeight: TRACK_HEIGHT + 40
          }}
        >
          {/* Time ruler */}
          <div className="sticky top-0 z-10 flex h-5 border-b border-white/5 bg-surface-raised/80 backdrop-blur-sm">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex h-full items-end"
                style={{left: timeToX(t)}}
              >
                <div className="h-2 w-px bg-white/15" />
                {t % 5 === 0 && (
                  <span className="ml-1 text-[9px] text-slate-600">
                    {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Segment blocks */}
          <div className="relative mt-1" style={{height: TRACK_HEIGHT}}>
            {project.segments.map((segment) => {
              const left = timeToX(segment.start);
              const width = Math.max(
                timeToX(segment.end - segment.start),
                20
              );

              return (
                <div
                  key={segment.id}
                  className={cn(
                    "absolute top-0 flex cursor-grab items-center overflow-hidden rounded-md border px-2 text-[10px] font-medium transition-colors select-none",
                    "border-violet-500/20 bg-violet-500/10 text-violet-200",
                    "hover:border-violet-500/40 hover:bg-violet-500/15",
                    selectedSegmentId === segment.id &&
                      "border-violet-500/60 bg-violet-500/20 ring-1 ring-violet-500/30",
                    dragging?.id === segment.id && "cursor-grabbing opacity-80"
                  )}
                  style={{
                    left,
                    width,
                    height: TRACK_HEIGHT
                  }}
                  onMouseDown={(e) =>
                    handleMouseDown(e, segment.id, segment.start, segment.end)
                  }
                >
                  <span className="truncate">{segment.line}</span>
                </div>
              );
            })}
          </div>

          {/* Beat markers */}
          {project.toggles.beatSync &&
            project.beats.map((beat, i) => (
              <div
                key={i}
                className="absolute top-5 h-full w-px bg-cyan-500/15"
                style={{left: timeToX(beat)}}
              />
            ))}

          {/* Playhead line */}
          <div
            className="absolute top-0 z-20 h-full w-0.5 bg-violet-500"
            style={{left: timeToX(playhead)}}
          >
            <div className="absolute -left-1.5 -top-0.5 h-2.5 w-3.5 rounded-sm bg-violet-500" />
          </div>
        </div>
      </div>
    </div>
  );
}


