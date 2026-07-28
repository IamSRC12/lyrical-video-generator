import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import {Audio} from "@remotion/media";
import type {EditorProject} from "../lib/editor-schema";
import {getAnimationStyle} from "./animations";
import {getActiveSegment, getHighlightedWordIndex} from "../lib/caption-timing";
import {getRhythmPulse} from "../lib/beat-sync";

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

  const rhythmPulse = project.toggles.beatSync
    ? getRhythmPulse(project.beats, currentTime)
    : 0;

  const rhythmScale = 1 + rhythmPulse * 0.035;

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
      <Audio
        src={project.audioUrl}
        requestInit={{cache: "no-store"}}
        onError={(error) => {
          console.error("Render audio error:", error.message);
          return "fail";
        }}
      />

      {/* Lyrics Container */}
      {activeSegment && (
        <div
          style={{
            position: "absolute",
            left: `${style.positionX}%`,
            top: `${style.positionY}%`,
            transform: `translate(-50%, -50%) scale(${rhythmScale}) ${animStyle.transform}`,
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
              textShadow:
                rhythmPulse > 0
                  ? `${style.shadow}, 0 0 ${12 + rhythmPulse * 20}px ${
                      style.highlightColor
                    }`
                  : animStyle.textShadow ?? style.shadow,
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
    </AbsoluteFill>
  );
};
