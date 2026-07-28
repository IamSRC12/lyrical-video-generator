"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {
  Clock,
  CornerDownLeft,
  ImagePlus,
  Music,
  Navigation,
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
import {getRhythmPulse} from "@/lib/beat-sync";
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
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const internalTimeUpdateRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingReverse, setIsPlayingReverse] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Jump to timestamp state
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [jumpInputValue, setJumpInputValue] = useState("");

  // Sync audio currentTime when playhead updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !project || internalTimeUpdateRef.current) return;

    if (Math.abs(audio.currentTime - playhead) > 0.15) {
      audio.currentTime = Math.max(
        0,
        Math.min(playhead, audio.duration || project.duration)
      );
    }
  }, [playhead, project]);

  // Clean up RAF loop on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Focus jump input when toggled open
  useEffect(() => {
    if (showJumpInput) {
      setTimeout(() => jumpInputRef.current?.focus(), 50);
    }
  }, [showJumpInput]);

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
          const uploaded = await uploadAsset(file);
          setBackground(uploaded.url);
          toast.success("Background image updated!");
        } catch {
          toast.error("Failed to upload image.");
        }
      } else if (file.type.startsWith("audio/")) {
        try {
          toast.info(`Uploading audio track: ${file.name}...`);
          const uploaded = await uploadAsset(file);
          setAudioUrl(uploaded.url);
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

  const rhythmPulse = project.toggles.beatSync
    ? getRhythmPulse(project.beats, playhead)
    : 0;

  const rhythmScale = 1 + rhythmPulse * 0.035;

  function stopAllPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsPlaying(false);
    setIsPlayingReverse(false);
    lastTimeRef.current = null;
  }

  function tick() {
    const audio = audioRef.current;

    if (!audio || audio.paused || audio.ended) {
      animationRef.current = null;
      return;
    }

    internalTimeUpdateRef.current = true;
    setPlayhead(audio.currentTime);

    queueMicrotask(() => {
      internalTimeUpdateRef.current = false;
    });

    animationRef.current = requestAnimationFrame(tick);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const totalDuration = project ? project.duration : 0;

    audio.currentTime = Math.max(
      0,
      Math.min(playhead, audio.duration || totalDuration)
    );

    try {
      await audio.play();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(tick);
    } catch {
      setIsPlaying(false);
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
    const duration = project ? project.duration : 0;
    const safeTime = Math.max(0, Math.min(duration, time));
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

  function parseTimestamp(str: string): number | null {
    const trimmed = str.trim();
    if (!trimmed) return null;
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      if (parts.length === 2) {
        const m = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
      } else if (parts.length === 3) {
        const h = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        const s = parseFloat(parts[2]);
        if (!isNaN(h) && !isNaN(m) && !isNaN(s)) return h * 3600 + m * 60 + s;
      }
    } else {
      const val = parseFloat(trimmed);
      if (!isNaN(val)) return val;
    }
    return null;
  }

  function executeJump() {
    if (!project) return;
    const seconds = parseTimestamp(jumpInputValue);
    if (seconds === null) {
      toast.error("Invalid timestamp format. Use MM:SS or seconds (e.g. 1:25 or 85)");
      return;
    }
    if (seconds < 0 || seconds > project.duration) {
      toast.error(`Timestamp out of range (0:00 - ${formatTime(project.duration)})`);
      return;
    }
    handleSeek(seconds);
    toast.success(`Jumped to ${formatTime(seconds)}`);
    setShowJumpInput(false);
    setJumpInputValue("");
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
              transform: `translate(-50%, -50%) scale(${rhythmScale}) ${animationStyle?.transform ?? ""}`,
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
                textShadow:
                  rhythmPulse > 0
                    ? `${style.shadow}, 0 0 ${12 + rhythmPulse * 20}px ${
                        style.highlightColor
                      }`
                    : animationStyle?.textShadow ?? style.shadow,
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
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Dedicated "Jump to Timestamp" Toggle Button */}
          <button
            className={cn(
              "button-ghost px-2 py-1 flex items-center gap-1.5 text-xs font-medium text-violet-400 transition-colors",
              showJumpInput && "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
            )}
            onClick={() => {
              setShowJumpInput(!showJumpInput);
              if (!showJumpInput) {
                setJumpInputValue(formatTime(playhead));
              }
            }}
            title="Jump to specific timestamp"
          >
            <Navigation size={13} />
            <span>Jump To</span>
          </button>

          {/* Inline Jump to Timestamp Input Popover */}
          {showJumpInput && (
            <div className="flex items-center gap-1.5 bg-black/60 border border-violet-500/40 rounded-md px-2 py-0.5 animate-fade-in">
              <Clock size={13} className="text-violet-400" />
              <input
                ref={jumpInputRef}
                type="text"
                value={jumpInputValue}
                onChange={(e) => setJumpInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") executeJump();
                  if (e.key === "Escape") setShowJumpInput(false);
                }}
                placeholder="MM:SS (e.g. 1:25)"
                className="w-24 bg-transparent text-xs font-mono text-white focus:outline-none placeholder:text-slate-500"
              />
              <button
                onClick={executeJump}
                className="button-primary px-1.5 py-0.5 text-[10px] flex items-center gap-1"
                title="Go to timestamp"
              >
                Go <CornerDownLeft size={10} />
              </button>
            </div>
          )}

          <div className="flex-1" />

          {/* Clickable time display to trigger Jump To */}
          <button
            className="font-mono text-xs text-slate-400 hover:text-violet-300 transition-colors"
            onClick={() => {
              setShowJumpInput(true);
              setJumpInputValue(formatTime(playhead));
            }}
            title="Click to jump to timestamp"
          >
            {formatTime(playhead)} / {formatTime(project.duration)}
          </button>
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={project.audioUrl}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setPlayhead(project.duration);

          if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
        }}
      />
    </div>
  );
}
