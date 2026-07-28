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
  animation: animationSchema.default("fade"),
  confidence: z.number().min(0).max(1).default(1),
  source: z
    .enum(["provided", "transcribed", "ai-recovered"])
    .default("provided")
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;

export const textStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontUrl: z.string().url().optional(),
  fontSize: z.number().min(20).max(220).default(84),
  fontWeight: z.number().int().min(100).max(900).default(800),
  lineHeight: z.number().min(0.8).max(2).default(1.2),
  letterSpacing: z.number().min(-10).max(30).default(0),

  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#fde047"),
  outlineColor: z.string().default("#111827"),
  outlineWidth: z.number().min(0).max(12).default(2),

  shadow: z.string().default("0 8px 26px rgba(0,0,0,.5)"),
  align: z.enum(["left", "center", "right"]).default("center"),

  positionX: z.number().min(0).max(100).default(50),
  positionY: z.number().min(0).max(100).default(50),

  textTransform: z
    .enum(["none", "uppercase", "lowercase"])
    .default("none"),

  backgroundColor: z.string().default("#000000"),
  backgroundOpacity: z.number().min(0).max(1).default(0),
  paddingX: z.number().min(0).max(100).default(20),
  paddingY: z.number().min(0).max(100).default(10),
  borderRadius: z.number().min(0).max(100).default(12)
});

const urlOrRelativePathSchema = z
  .string()
  .min(1)
  .refine((val) => {
    if (val.startsWith("/")) return true;
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, "Must be a valid URL or relative path (e.g. /api/assets/...)");

export const projectSchema = z.object({
  version: z.literal(1),
  title: z.string().default("Untitled lyrical video"),
  fps: z.number().int().min(24).max(60).default(30),
  width: z.union([z.literal(1280), z.literal(1920)]).default(1920),
  height: z.union([z.literal(720), z.literal(1080)]).default(1080),
  duration: z.number().positive(),
  audioUrl: urlOrRelativePathSchema,
  backgroundUrl: urlOrRelativePathSchema.optional(),
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
