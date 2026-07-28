import { z } from "zod";

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
  end: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional()
});

export type TimedWord = z.infer<typeof timedWordSchema>;

export const lyricSegmentSchema = z.object({
  id: z.string(),
  line: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  words: z.array(timedWordSchema),
  animation: animationSchema.default("fade"),
  animationIntensity: z.number().min(0.1).max(3).default(1),
  confidence: z.number().min(0).max(1).optional(),
  requiresReview: z.boolean().default(false)
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;

export const textStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontUrl: z.string().url().optional(),
  fontSize: z.number().min(12).max(250).default(72),
  fontWeight: z.number().int().min(100).max(900).default(800),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  lineHeight: z.number().min(0.8).max(2.5).default(1.2),
  letterSpacing: z.number().min(-10).max(50).default(0),

  color: z.string().default("#ffffff"),
  highlightColor: z.string().default("#fde047"),
  outlineColor: z.string().default("#000000"),
  outlineWidth: z.number().min(0).max(20).default(2),

  shadowColor: z.string().default("rgba(0, 0, 0, 0.75)"),
  shadowBlur: z.number().min(0).max(50).default(16),
  shadowOffsetX: z.number().min(-50).max(50).default(0),
  shadowOffsetY: z.number().min(-50).max(50).default(8),

  align: z.enum(["left", "center", "right"]).default("center"),

  positionX: z.number().min(0).max(100).default(50),
  positionY: z.number().min(0).max(100).default(50),
  maxWidthPercent: z.number().min(20).max(100).default(90),

  textTransform: z
    .enum(["none", "uppercase", "lowercase"])
    .default("none"),

  backgroundColor: z.string().default("#000000"),
  backgroundOpacity: z.number().min(0).max(1).default(0),
  paddingX: z.number().min(0).max(100).default(20),
  paddingY: z.number().min(0).max(100).default(10),
  borderRadius: z.number().min(0).max(100).default(12)
});

export type TextStyle = z.infer<typeof textStyleSchema>;

export const projectSchema = z.object({
  version: z.literal(1),
  title: z.string().default("Untitled Lyrical Video"),
  fps: z.number().int().min(24).max(60).default(30),
  width: z.union([z.literal(1280), z.literal(1920), z.literal(1080)]).default(1920),
  height: z.union([z.literal(720), z.literal(1080), z.literal(1920)]).default(1080),
  duration: z.number().positive(),
  audioUrl: z.string(),
  backgroundUrl: z.string().optional(),
  backgroundColor: z.string().default("#090d16"),
  segments: z.array(lyricSegmentSchema),
  beats: z.array(z.number().nonnegative()).default([]),
  bpm: z.number().optional(),
  textStyle: textStyleSchema,
  toggles: z.object({
    beatSync: z.boolean().default(false),
    contextualAnimations: z.boolean().default(true),
    karaokeHighlight: z.boolean().default(true)
  })
});

export type EditorProject = z.infer<typeof projectSchema>;

export const defaultTextStyle: TextStyle = textStyleSchema.parse({});
