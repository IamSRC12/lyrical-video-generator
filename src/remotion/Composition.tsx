
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import type {EditorProject} from "../lib/editor-schema";
import {getAnimationStyle} from "./animations";
import {getActiveSegment, getHighlightedWordIndex} from "../lib/caption-timing";

type CompositionProps = {
  project: EditorProject;
};

export const LyricalVideoComposition: React.FC<CompositionProps> = ({
  project
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentTime = frame / fps;

  const activeSegment = getActiveSegment(project.segments, currentTime);

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

  const highlightUpTo = activeSegment
    ? getHighlightedWordIndex(activeSegment, currentTime)
    : -1;

  const style = project.textStyle;

  return (
    <AbsoluteFill>
      {/* Background */}
      <AbsoluteFill style={{backgroundColor: project.backgroundColor}}>
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

      {/* Lyrics Container */}
      {activeSegment && (
        <div
          style={{
            position: "absolute",
            left: `${style.positionX}%`,
            top: `${style.positionY}%`,
            transform: `translate(-50%, -50%) ${animStyle.transform}`,
            opacity: animStyle.opacity,
            filter: animStyle.filter,
            textAlign: style.align,
            maxWidth: "85%",
            backgroundColor: `color-mix(in srgb, ${style.backgroundColor} ${
              style.backgroundOpacity * 100
            }%, transparent)`,
            padding: `${style.paddingY}px ${style.paddingX}px`,
            borderRadius: `${style.borderRadius}px`
          }}
        >
          <p
            style={{
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              lineHeight: style.lineHeight,
              letterSpacing: `${style.letterSpacing}px`,
              textTransform: style.textTransform,
              color: style.color,
              textShadow: animStyle.textShadow ?? style.shadow,
              WebkitTextStroke: `${style.outlineWidth}px ${style.outlineColor}`,
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


