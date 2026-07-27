import {z} from "zod";

export const animationSchema = z.enum([
  "fade",
  "slide_up",
  "pop",
  "neon_pulse",
  "zoom_blur",
  "rain",
  "shake"
]);

export type AnimationName = z.infer<typeof animationSchema>;

export const timedWordSchema = z.object({
  word: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative()
});

export type TimedWord = z.infer<typeof timedWordSchema>;

export const lyricSegmentSchema = z.object({
  id: z.string(),
  line: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  words: z.array(timedWordSchema),
  animation: animationSchema.default("fade")
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;

export const textStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontUrl: z.string().url().optional(),
  fontSize: z.number().min(20).max(220).default(84),
  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#fde047"),
  outlineColor: z.string().default("#111827"),
  outlineWidth: z.number().min(0).max(12).default(2),
  shadow: z.string().default("0 8px 26px rgba(0,0,0,.5)"),
  align: z.enum(["left", "center", "right"]).default("center")
});

export const projectSchema = z.object({
  version: z.literal(1),
  title: z.string().default("Untitled lyrical video"),
  fps: z.number().int().min(24).max(60).default(30),
  width: z.union([z.literal(1280), z.literal(1920)]).default(1920),
  height: z.union([z.literal(720), z.literal(1080)]).default(1080),
  duration: z.number().positive(),
  audioUrl: z.string().url(),
  backgroundUrl: z.string().url().optional(),
  backgroundColor: z.string().default("#111827"),
  segments: z.array(lyricSegmentSchema),
  beats: z.array(z.number().nonnegative()).default([]),
  textStyle: textStyleSchema,
  toggles: z.object({
    beatSync: z.boolean().default(false),
    contextualAnimations: z.boolean().default(false),
    karaokeHighlight: z.boolean().default(true)
  })
});

export type EditorProject = z.infer<typeof projectSchema>;

export const defaultTextStyle = textStyleSchema.parse({});
