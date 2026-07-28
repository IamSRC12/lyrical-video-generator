"use client";

import { LyricalComposition } from "@/remotion/Composition";
import { useEditorStore } from "@/stores/editor-store";
import { Player, PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";

export function PreviewCanvas() {
  const project = useEditorStore((s) => s.project);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const playerRef = useRef<PlayerRef>(null);

  if (!project) return null;

  const durationInFrames = Math.max(1, Math.ceil((project.duration || 10) * project.fps));

  // Listen to frame update events from Remotion Player ref
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrame = (e: { detail: { frame: number } }) => {
      if (isPlaying) {
        const newTime = e.detail.frame / project.fps;
        setCurrentTime(newTime);
      }
    };

    player.addEventListener("frameupdate", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
    };
  }, [isPlaying, project.fps, setCurrentTime]);

  // Sync player play/pause state
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying]);

  // Sync player seek position when currentTime changes
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const frame = Math.floor(currentTime * project.fps);
    if (Math.abs(player.getCurrentFrame() - frame) > 1) {
      player.seekTo(frame);
    }
  }, [currentTime, project.fps]);

  return (
    <div className="relative aspect-video h-full max-h-full max-w-full overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-2xl flex items-center justify-center">
      <Player
        ref={playerRef}
        component={LyricalComposition}
        inputProps={{ project }}
        durationInFrames={durationInFrames}
        compositionWidth={project.width}
        compositionHeight={project.height}
        fps={project.fps}
        style={{
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          objectFit: "contain"
        }}
        controls={false}
        loop
      />
    </div>
  );
}
