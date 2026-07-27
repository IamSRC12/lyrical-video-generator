import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type {EditorProject} from "@/lib/editor-schema";
import {getAnimationStyle} from "./animations";

type CompositionProps = {
  project: EditorProject;
};

export const LyricalVideoComposition: React.FC<CompositionProps> = ({
  project
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTime = frame / fps;

  // Find active segment
  const activeSegment = project.segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  // Calculate animation progress for active segment
  const segmentProgress = activeSegment
    ? Math.min(
        1,
        (currentTime - activeSegment.start) /
          Math.max(0.1, (activeSegment.end - activeSegment.start) * 0.3)
      )
    : 0;

  const animStyle = activeSegment
    ? getAnimationStyle(activeSegment.animation, segmentProgress)
    : {opacity: 0, transform: "none"};

  // Find active word index for karaoke
  const activeWordIndex = activeSegment
    ? activeSegment.words.findIndex(
        (w) => currentTime >= w.start && currentTime <= w.end
      )
    : -1;

  // Determine which words have been spoken (for progressive highlight)
  const spokenWordIndex = activeSegment
    ? activeSegment.words.findIndex((w) => currentTime < w.start) - 1
    : -1;

  const highlightUpTo = Math.max(
    activeWordIndex,
    spokenWordIndex >= 0 ? spokenWordIndex : -1
  );

  return (
    <AbsoluteFill>
      {/* Background */}
      <AbsoluteFill
        style={{backgroundColor: project.backgroundColor}}
      >
        {project.backgroundUrl && (
          <Img
            src={project.backgroundUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        )}

        {/* Gradient overlay */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.6), transparent, rgba(0,0,0,0.3))"
          }}
        />
      </AbsoluteFill>

      {/* Audio */}
      <Audio src={project.audioUrl} />

      {/* Lyrics */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "5%"
        }}
      >
        {activeSegment && (
          <div
            style={{
              textAlign: project.textStyle.align,
              opacity: animStyle.opacity,
              transform: animStyle.transform,
              filter: animStyle.filter,
              maxWidth: "85%"
            }}
          >
            <p
              style={{
                fontFamily: project.textStyle.fontFamily,
                fontSize: project.textStyle.fontSize,
                fontWeight: 800,
                lineHeight: 1.2,
                color: project.textStyle.color,
                textShadow:
                  animStyle.textShadow ?? project.textStyle.shadow,
                WebkitTextStroke: `${project.textStyle.outlineWidth}px ${project.textStyle.outlineColor}`,
                margin: 0
              }}
            >
              {project.toggles.karaokeHighlight
                ? activeSegment.words.map((word, i) => (
                    <span
                      key={i}
                      style={{
                        color:
                          i <= highlightUpTo
                            ? project.textStyle.highlightColor
                            : project.textStyle.color,
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
      </AbsoluteFill>

      {/* Beat sync flash overlay */}
      {project.toggles.beatSync && (() => {
        const nearestBeat = project.beats.reduce(
          (closest, beat) =>
            Math.abs(beat - currentTime) < Math.abs(closest - currentTime)
              ? beat
              : closest,
          Infinity
        );

        const beatDistance = Math.abs(currentTime - nearestBeat);
        const flashOpacity =
          beatDistance < 0.08
            ? (1 - beatDistance / 0.08) * 0.12
            : 0;

        return flashOpacity > 0 ? (
          <AbsoluteFill
            style={{
              backgroundColor: `rgba(139, 92, 246, ${flashOpacity})`,
              pointerEvents: "none"
            }}
          />
        ) : null;
      })()}
    </AbsoluteFill>
  );
};
