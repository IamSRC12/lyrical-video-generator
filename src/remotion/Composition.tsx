import type { EditorProject } from "@/lib/editor-schema";
import { Audio, AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getAnimationStyle, type AnimationStyle } from "./animations";

type LyricalCompositionProps = {
  project: EditorProject;
};

export const LyricalComposition: React.FC<LyricalCompositionProps> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const style = project.textStyle;

  // Find active segment by currentTime
  const activeSegment = project.segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  let activeAnimStyle: AnimationStyle = { opacity: 0, transform: "none" };

  if (activeSegment) {
    const startFrame = Math.floor(activeSegment.start * fps);
    const endFrame = Math.floor(activeSegment.end * fps);

    activeAnimStyle = getAnimationStyle({
      animation: activeSegment.animation,
      frame,
      fps,
      segmentStartFrame: startFrame,
      segmentEndFrame: endFrame,
      intensity: activeSegment.animationIntensity
    });
  }

  // Beat pulse calculation
  let beatScale = 1.0;
  if (project.beatSyncEnabled && project.beats?.length) {
    const isNearBeat = project.beats.some((b) => Math.abs(b - currentTime) < 0.08);
    if (isNearBeat) {
      beatScale = 1.05;
    }
  }

  // Karaoke enablement check: per-segment override takes precedence over project-level toggle
  const isKaraokeActive = activeSegment
    ? (activeSegment.karaokeOverride ?? project.karaokeEnabled ?? true)
    : false;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: project.backgroundColor || "#090d16",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: style.fontFamily || "Inter",
        overflow: "hidden"
      }}
    >
      {/* Background Image Overlay */}
      {project.backgroundUrl && (
        <AbsoluteFill>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.backgroundUrl}
            alt="Background"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6
            }}
          />
        </AbsoluteFill>
      )}

      {/* Render Single Audio Track */}
      {project.audioUrl && <Audio src={project.audioUrl} />}

      {/* Active Lyric Line */}
      {activeSegment && (
        <div
          style={{
            position: "absolute",
            top: `${style.positionY}%`,
            left: `${style.positionX}%`,
            transform: `translate(-50%, -50%) scale(${beatScale}) ${activeAnimStyle.transform}`,
            opacity: activeAnimStyle.opacity,
            filter: activeAnimStyle.filter,
            textAlign: style.align,
            maxWidth: `${style.maxWidthPercent}%`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            lineHeight: style.lineHeight,
            letterSpacing: `${style.letterSpacing}px`,
            color: style.color,
            WebkitTextStroke: `${style.outlineWidth}px ${style.outlineColor}`,
            textShadow: `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`,
            textTransform: style.textTransform,
            backgroundColor:
              style.backgroundOpacity > 0
                ? style.backgroundColor
                : "transparent",
            padding: `${style.paddingY}px ${style.paddingX}px`,
            borderRadius: `${style.borderRadius}px`,
            transition: "transform 0.05s ease-out"
          }}
        >
          {isKaraokeActive && activeSegment.words?.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: style.align, gap: "0.25em" }}>
              {activeSegment.words.map((w) => {
                const isWordActive = currentTime >= w.start;
                return (
                  <span
                    key={w.id}
                    style={{
                      color: isWordActive ? style.highlightColor : style.color,
                      transform: isWordActive ? "scale(1.06)" : "scale(1.0)",
                      transition: "color 0.08s ease, transform 0.08s ease"
                    }}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
          ) : (
            <span>{activeSegment.text}</span>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
