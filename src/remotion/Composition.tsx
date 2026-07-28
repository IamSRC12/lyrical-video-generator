import type { EditorProject } from "@/lib/editor-schema";
import { Audio, AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getAnimationStyle } from "./animations";

type LyricalCompositionProps = {
  project: EditorProject;
};

export const LyricalComposition: React.FC<LyricalCompositionProps> = ({ project }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const style = project.textStyle;

  // Active lyric segment
  const activeSegment = project.segments.find(
    (seg) => currentTime >= seg.start && currentTime <= seg.end
  );

  let activeAnimStyle = { opacity: 0, transform: "none" };

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
  if (project.toggles?.beatSync && project.beats?.length) {
    const isNearBeat = project.beats.some((b) => Math.abs(b - currentTime) < 0.08);
    if (isNearBeat) {
      beatScale = 1.05;
    }
  }

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
      {/* Background Image/Color Overlay */}
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

      {/* Render Audio Track */}
      {project.audioUrl && <Audio src={project.audioUrl} />}

      {/* Active Lyric Display */}
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
          {/* Word-level Karaoke Highlighting */}
          {project.toggles?.karaokeHighlight && activeSegment.words?.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: style.align, gap: "0.25em" }}>
              {activeSegment.words.map((w, idx) => {
                const isWordActive = currentTime >= w.start && currentTime <= w.end;
                return (
                  <span
                    key={idx}
                    style={{
                      color: isWordActive ? style.highlightColor : style.color,
                      transform: isWordActive ? "scale(1.08)" : "scale(1.0)",
                      transition: "color 0.1s ease, transform 0.1s ease"
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          ) : (
            <span>{activeSegment.line}</span>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
