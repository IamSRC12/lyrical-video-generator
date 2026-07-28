"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {
  ImagePlus,
  Music,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  RotateCw,
  SkipBack,
  Upload,
  Volume2,
  VolumeX
} from "lucide-react";
import {getActiveSegment, getHighlightedWordIndex} from "@/lib/caption-timing";
import {getAnimationStyle} from "@/remotion/animations";
import {uploadAsset} from "@/services/asset-client";
import {toast} from "sonner";
import {cn} from "@/lib/cn";

export function PreviewCanvas() {
  const project = useEditorStore((s) => s.project);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setBackground = useEditorStore((s) => s.setBackground);
  const setAudioUrl = useEditorStore((s) => s.setAudioUrl);

  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingReverse, setIsPlayingReverse] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Sync audio currentTime when playhead is updated from outside while paused
  useEffect(() => {
    if (audioRef.current && !isPlaying && !isPlayingReverse) {
      if (Math.abs(audioRef.current.currentTime - playhead) > 0.1) {
        audioRef.current.currentTime = playhead;
      }
    }
  }, [playhead, isPlaying, isPlayingReverse]);

  // Handle Drag and Drop for images and audio
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const file = e.dataTransfer.files[0];
      if (!file) return;

      if (file.type.startsWith("image/")) {
        try {
          toast.info(`Uploading background image: ${file.name}...`);
          const url = await uploadAsset(file);
          setBackground(url);
          toast.success("Background image updated!");
        } catch {
          toast.error("Failed to upload image.");
        }
      } else if (file.type.startsWith("audio/")) {
        try {
          toast.info(`Uploading audio track: ${file.name}...`);
          const url = await uploadAsset(file);
          setAudioUrl(url);
          toast.success("Audio track updated!");
        } catch {
          toast.error("Failed to upload audio file.");
        }
      } else {
        toast.error("Please drop an image or audio file.");
      }
    },
    [setBackground, setAudioUrl]
  );

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

  function stopAllPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
    setIsPlayingReverse(false);
    lastTimeRef.current = null;
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      stopAllPlayback();
    } else {
      stopAllPlayback();
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

  function togglePlayReverse() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingReverse) {
      stopAllPlayback();
    } else {
      stopAllPlayback();
      setIsPlayingReverse(true);
      lastTimeRef.current = performance.now();

      function reverseTick(now: number) {
        if (lastTimeRef.current !== null) {
          const delta = (now - lastTimeRef.current) / 1000;
          lastTimeRef.current = now;

          useEditorStore.setState((state) => {
            const nextPlayhead = Math.max(0, state.playhead - delta);
            if (audioRef.current) {
              audioRef.current.currentTime = nextPlayhead;
            }
            if (nextPlayhead <= 0) {
              stopAllPlayback();
              return {playhead: 0};
            }
            return {playhead: nextPlayhead};
          });

          animationRef.current = requestAnimationFrame(reverseTick);
        }
      }
      animationRef.current = requestAnimationFrame(reverseTick);
    }
  }

  function handleSeek(time: number) {
    const safeTime = Math.max(0, Math.min(project.duration, time));
    setPlayhead(safeTime);
    if (audioRef.current) {
      audioRef.current.currentTime = safeTime;
    }
  }

  function handleSkip(seconds: number) {
    handleSeek(playhead + seconds);
  }

  function handleRestart() {
    handleSeek(0);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div
      className={cn(
        "editor-preview relative flex flex-col overflow-hidden bg-black/40",
        dragActive && "ring-2 ring-violet-500 ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {dragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-all animate-fade-in pointer-events-none">
          <Upload size={48} className="text-violet-400 animate-bounce" />
          <p className="mt-4 text-lg font-bold text-white">Drop media here</p>
          <div className="mt-2 flex gap-4 text-xs text-slate-300">
            <span className="flex items-center gap-1">
              <ImagePlus size={14} className="text-pink-400" /> Image for Background
            </span>
            <span className="flex items-center gap-1">
              <Music size={14} className="text-cyan-400" /> Audio for Track
            </span>
          </div>
        </div>
      )}

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

      {/* Interactive Transport & Scrubber Bar */}
      <div className="flex flex-col border-t border-white/5 bg-surface-raised px-4 py-2 gap-2">
        {/* Real-time Scrubber Range Slider */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={project.duration || 100}
            step={0.05}
            value={playhead}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer accent-violet-500 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
            title="Drag to jump to specific point"
          />
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            className="button-ghost p-1.5"
            onClick={handleRestart}
            title="Restart (0:00)"
          >
            <SkipBack size={15} />
          </button>

          <button
            className="button-ghost p-1.5"
            onClick={() => handleSkip(-5)}
            title="Skip backward 5 seconds"
          >
            <RotateCcw size={15} />
          </button>

          {/* Reverse Play button */}
          <button
            className={cn(
              "button-ghost p-1.5 transition-colors",
              isPlayingReverse && "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40"
            )}
            onClick={togglePlayReverse}
            title={isPlayingReverse ? "Pause reverse playback" : "Play backward"}
          >
            <Rewind size={16} />
          </button>

          {/* Play/Pause button */}
          <button
            className={cn(
              "button-ghost p-1.5 transition-colors",
              isPlaying && "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40"
            )}
            onClick={togglePlay}
            title={isPlaying ? "Pause" : "Play forward"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <button
            className="button-ghost p-1.5"
            onClick={() => handleSkip(5)}
            title="Skip forward 5 seconds"
          >
            <RotateCw size={15} />
          </button>

          <button
            className="button-ghost p-1.5"
            onClick={() => {
              setIsMuted(!isMuted);
              if (audioRef.current) audioRef.current.muted = !isMuted;
            }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <div className="flex-1" />

          <span className="font-mono text-xs text-slate-400">
            {formatTime(playhead)} / {formatTime(project.duration)}
          </span>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={project.audioUrl}
        preload="auto"
        onEnded={() => {
          stopAllPlayback();
        }}
      />
    </div>
  );
}
