"use client";

import {useEffect, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {Pause, Play, SkipBack, Volume2, VolumeX} from "lucide-react";

/**
 * Preview canvas that shows a styled lyric preview synchronized with audio.
 * When Remotion Player is available (future enhancement), this wraps it.
 * For now, this provides a native audio + canvas-based lyric preview.
 */
export function PreviewCanvas() {
  const project = useEditorStore((s) => s.project);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);

  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!project) {
    return (
      <div className="editor-preview grid place-items-center bg-surface">
        <p className="text-sm text-slate-600">No project loaded</p>
      </div>
    );
  }

  // Find the active segment at current playhead
  const activeSegment = project.segments.find(
    (s) => playhead >= s.start && playhead <= s.end
  );

  // Find the active word for karaoke highlighting
  const activeWordIndex = activeSegment?.words.findIndex(
    (w) => playhead >= w.start && playhead <= w.end
  );

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setIsPlaying(false);
    } else {
      audio.currentTime = playhead;
      audio.play();
      setIsPlaying(true);

      function tick() {
        if (audioRef.current && !audioRef.current.paused) {
          setPlayhead(audioRef.current.currentTime);
          animationRef.current = requestAnimationFrame(tick);
        }
      }
      tick();
    }
  }

  function handleRestart() {
    setPlayhead(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div className="editor-preview flex flex-col overflow-hidden bg-black/40">
      {/* Preview viewport */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{
          backgroundColor: project.backgroundColor,
          backgroundImage: project.backgroundUrl
            ? `url(${project.backgroundUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Lyric display */}
        <div
          className="relative z-10 max-w-[80%] px-6"
          style={{textAlign: project.textStyle.align}}
        >
          {activeSegment ? (
            <p
              className="animate-fade-in"
              key={activeSegment.id}
              style={{
                fontFamily: project.textStyle.fontFamily,
                fontSize: `${Math.min(project.textStyle.fontSize * 0.6, 80)}px`,
                color: project.textStyle.color,
                textShadow: project.textStyle.shadow,
                WebkitTextStroke: `${project.textStyle.outlineWidth * 0.5}px ${project.textStyle.outlineColor}`,
                lineHeight: 1.3,
                fontWeight: 800
              }}
            >
              {project.toggles.karaokeHighlight
                ? activeSegment.words.map((word, i) => (
                    <span
                      key={i}
                      style={{
                        color:
                          activeWordIndex !== undefined && i <= activeWordIndex
                            ? project.textStyle.highlightColor
                            : project.textStyle.color,
                        transition: "color 0.1s ease"
                      }}
                    >
                      {word.word}{" "}
                    </span>
                  ))
                : activeSegment.line}
            </p>
          ) : (
            <p
              className="text-sm italic"
              style={{color: "rgba(255,255,255,0.25)"}}
            >
              ♪ ♪ ♪
            </p>
          )}
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center gap-3 border-t border-white/5 bg-surface-raised px-4 py-2">
        <button className="button-ghost" onClick={handleRestart}>
          <SkipBack size={14} />
        </button>

        <button className="button-ghost" onClick={togglePlay}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button
          className="button-ghost"
          onClick={() => {
            setIsMuted(!isMuted);
            if (audioRef.current) audioRef.current.muted = !isMuted;
          }}
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <div className="flex-1" />

        <span className="font-mono text-xs text-slate-500">
          {formatTime(playhead)} / {formatTime(project.duration)}
        </span>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={project.audioUrl}
        preload="auto"
        onEnded={() => {
          setIsPlaying(false);
          if (animationRef.current) cancelAnimationFrame(animationRef.current);
        }}
      />
    </div>
  );
}
