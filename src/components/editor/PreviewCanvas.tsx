"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useEditorStore} from "@/stores/editor-store";
import {Player, CallbackListener, PlayerRef} from "@remotion/player";
import {LyricalVideoComposition} from "@/remotion/Composition";
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
import {uploadAsset} from "@/services/asset-client";
import {toast} from "sonner";
import {cn} from "@/lib/cn";

export function PreviewCanvas() {
  const project = useEditorStore((s) => s.project);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setBackground = useEditorStore((s) => s.setBackground);
  const setAudioUrl = useEditorStore((s) => s.setAudioUrl);

  const playerRef = useRef<PlayerRef>(null);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const internalSeekRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingReverse, setIsPlayingReverse] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Jump to timestamp state
  const [showJumpInput, setShowJumpInput] = useState(false);
  const [jumpInputValue, setJumpInputValue] = useState("");

  // Sync player position when playhead is changed externally
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !project || internalSeekRef.current) return;

    const targetFrame = Math.round(playhead * project.fps);
    const currentFrame = player.getCurrentFrame();

    if (Math.abs(currentFrame - targetFrame) > 1) {
      player.seekTo(targetFrame);
    }
  }, [playhead, project]);

  // Player frame update listener
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !project) return;

    const onFrameUpdate: CallbackListener<"frameupdate"> = (e) => {
      internalSeekRef.current = true;
      setPlayhead(e.detail.frame / project.fps);
      queueMicrotask(() => {
        internalSeekRef.current = false;
      });
    };

    const onPlay: CallbackListener<"play"> = () => setIsPlaying(true);
    const onPause: CallbackListener<"pause"> = () => setIsPlaying(false);
    const onEnded: CallbackListener<"ended"> = () => {
      setIsPlaying(false);
      setPlayhead(project.duration);
    };

    player.addEventListener("frameupdate", onFrameUpdate);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);

    return () => {
      player.removeEventListener("frameupdate", onFrameUpdate);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
    };
  }, [project, setPlayhead]);

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
          const uploadedUrl = await uploadAsset(file);
          setBackground(uploadedUrl);
          toast.success("Background image updated!");
        } catch {
          toast.error("Failed to upload image.");
        }
      } else if (file.type.startsWith("audio/")) {
        try {
          toast.info(`Uploading audio track: ${file.name}...`);
          const uploadedUrl = await uploadAsset(file);
          setAudioUrl(uploadedUrl);
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

  function handleSeek(time: number) {
    if (!project) return;
    const safeTime = Math.max(0, Math.min(project.duration, time));
    setPlayhead(safeTime);
    playerRef.current?.seekTo(Math.round(safeTime * project.fps));
  }

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;

    if (player.isPlaying()) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }

  function togglePlayReverse() {
    const player = playerRef.current;
    if (!player || !project) return;

    if (isPlayingReverse) {
      setIsPlayingReverse(false);
      player.pause();
    } else {
      player.pause();
      setIsPlayingReverse(true);

      const interval = setInterval(() => {
        const currentFrame = player.getCurrentFrame();
        if (currentFrame <= 0) {
          clearInterval(interval);
          setIsPlayingReverse(false);
          player.seekTo(0);
          setPlayhead(0);
        } else {
          const nextFrame = Math.max(0, currentFrame - 1);
          player.seekTo(nextFrame);
          setPlayhead(nextFrame / project.fps);
        }
      }, 1000 / project.fps);
    }
  }

  function handleSkip(seconds: number) {
    handleSeek(playhead + seconds);
  }

  function handleRestart() {
    handleSeek(0);
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted) {
      player.unmute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
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
      toast.error(
        "Invalid timestamp format. Use MM:SS or seconds (e.g. 1:25 or 85)"
      );
      return;
    }
    if (seconds < 0 || seconds > project.duration) {
      toast.error(
        `Timestamp out of range (0:00 - ${formatTime(project.duration)})`
      );
      return;
    }
    handleSeek(seconds);
    toast.success(`Jumped to ${formatTime(seconds)}`);
    setShowJumpInput(false);
    setJumpInputValue("");
  }

  const durationInFrames = Math.max(
    1,
    Math.ceil(project.duration * project.fps)
  );

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

      {/* Preview viewport driven by Remotion Player */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden select-none bg-black">
        <Player
          ref={playerRef}
          component={LyricalVideoComposition}
          inputProps={{project}}
          durationInFrames={durationInFrames}
          fps={project.fps}
          compositionWidth={project.width}
          compositionHeight={project.height}
          style={{
            width: "100%",
            height: "100%"
          }}
          controls={false}
          clickToPlay={false}
        />
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
              isPlayingReverse &&
                "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40"
            )}
            onClick={togglePlayReverse}
            title={
              isPlayingReverse ? "Pause reverse playback" : "Play backward"
            }
          >
            <Rewind size={16} />
          </button>

          {/* Play/Pause button */}
          <button
            className={cn(
              "button-ghost p-1.5 transition-colors",
              isPlaying &&
                "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/40"
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
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Dedicated "Jump to Timestamp" Toggle Button */}
          <button
            className={cn(
              "button-ghost px-2 py-1 flex items-center gap-1.5 text-xs font-medium text-violet-400 transition-colors",
              showJumpInput &&
                "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
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
    </div>
  );
}
