import { defaultTextStyle, type EditorProject } from "@/lib/editor-schema";
import { Composition } from "remotion";
import { LyricalComposition } from "./Composition";

const defaultProjectProps: EditorProject = {
  version: 1,
  title: "Default Preview",
  fps: 30,
  width: 1920,
  height: 1080,
  duration: 10,
  audioUrl: "",
  backgroundColor: "#090d16",
  segments: [],
  beats: [],
  textStyle: defaultTextStyle,
  toggles: {
    beatSync: false,
    contextualAnimations: true,
    karaokeHighlight: true
  }
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LyricalVideo"
      component={LyricalComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        project: defaultProjectProps
      }}
    />
  );
};
