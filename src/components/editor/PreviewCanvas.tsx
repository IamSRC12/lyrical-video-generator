
"use client";

import {useEffect, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {Pause, Play, SkipBack, Volume2, VolumeX} from "lucide-react";
import {getActiveSegment, getHighlightedWordIndex} from "@/lib/caption-timing";
import {getAnimationStyle} from "@/remotion/animations";

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

  const activeSegment = getActiveSegment(project.segments, playhead);

  const activeWordIndex = activeSegment
    ? getHighlightedWordIndex(activeSegment, playhead)
    : -1;

  const animationProgress = activeSegment
    ? Math.min(
        1,
        Math.max(
          0,
          (playhead - activeSegment.start) /
            Math.max(
              0.1,
              Math.min(
                0.7,
                (activeSegment.end - activeSegment.start) * 0.3
              )
            )
        )
      )
    : 0;

  const animationStyle = activeSegment
    ? getAnimationStyle(activeSegment.animation, animationProgress)
    : undefined;

  const style = project.textStyle;

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
        className="relative flex flex-1 items-center justify-center overflow-hidden select-none"
        style={{
          backgroundColor: project.backgroundColor,
          backgroundImage: project.backgroundUrl
            ? `url(${project.backgroundUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Lyric display */}
        {activeSegment && (
          <div
            className="absolute max-w-[85%] transition-all"
            style={{
              left: `${style.positionX}%`,
              top: `${style.positionY}%`,
              transform: `translate(-50%, -50%) ${animationStyle?.transform ?? ""}`,
              opacity: animationStyle?.opacity ?? 1,
              filter: animationStyle?.filter,
              textAlign: style.align,
              backgroundColor: `color-mix(in srgb, ${style.backgroundColor} ${
                style.backgroundOpacity * 100
              }%, transparent)`,
              padding: `${style.paddingY}px ${style.paddingX}px`,
              borderRadius: `${style.borderRadius}px`,
              willChange: "transform, opacity, filter"
            }}
          >
            <p
              style={{
                fontFamily: style.fontFamily,
                fontSize: `${Math.min(style.fontSize * 0.55, 76)}px`,
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight,
                letterSpacing: `${style.letterSpacing * 0.5}px`,
                textTransform: style.textTransform,
                color: style.color,
                textShadow: animationStyle?.textShadow ?? style.shadow,
                WebkitTextStroke: `${style.outlineWidth * 0.5}px ${style.outlineColor}`,
                margin: 0
              }}
            >
              {project.toggles.karaokeHighlight
                ? activeSegment.words.map((word, i) => (
                    <span
                      key={i}
                      style={{
                        color:
                          i <= activeWordIndex
                            ? style.highlightColor
                            : style.color,
                        transition: "color 0.08s ease"
                      }}
                    >
                      {word.word}{" "}
                    </span>
                  ))
                : activeSegment.line}
            </p>
          </div>
        )}
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


