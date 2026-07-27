import React from "react";
import {Composition} from "remotion";
import {LyricalVideoComposition} from "./Composition";
import type {EditorProject} from "../lib/editor-schema";
import {defaultTextStyle} from "../lib/editor-schema";

const defaultProject: EditorProject = {
  version: 1,
  title: "Preview",
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 10,
  audioUrl: "",
  backgroundColor: "#111827",
  segments: [],
  beats: [],
  textStyle: {...defaultTextStyle},
  toggles: {
    beatSync: false,
    contextualAnimations: false,
    karaokeHighlight: true
  }
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LyricalVideo"
        component={LyricalVideoComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{project: defaultProject}}
        calculateMetadata={async ({props}) => {
          const project = props.project;
          return {
            durationInFrames: Math.ceil(project.duration * project.fps),
            fps: project.fps,
            width: project.width,
            height: project.height
          };
        }}
      />
    </>
  );
};
