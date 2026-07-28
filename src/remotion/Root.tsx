import { defaultTextStyle, type EditorProject } from "@/lib/editor-schema";
import { Composition } from "remotion";
import { LyricalComposition } from "./Composition";

const defaultProjectProps: EditorProject = {
  version: 2,
  id: "default-project",
  title: "Default 60 FPS Preview",
  fps: 60,
  width: 1920,
  height: 1080,
  duration: 10,
  audioAssetId: "",
  audioUrl: "",
  backgroundColor: "#090d16",
  karaokeEnabled: true,
  beatSyncEnabled: false,
  segments: [],
  beats: [],
  textStyle: defaultTextStyle
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LyricalVideo"
      component={LyricalComposition}
      durationInFrames={600}
      fps={60}
      width={1920}
      height={1080}
      defaultProps={{
        project: defaultProjectProps
      }}
    />
  );
};
