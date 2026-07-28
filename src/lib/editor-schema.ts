import { z } from "zod";

export const animationSchema = z.enum([
  "none",
  "fade",
  "slide_up",
  "pop",
  "neon_pulse",
  "zoom_blur",
  "rain",
  "shake"
]);

export type AnimationName = z.infer<typeof animationSchema>;

export const animationModeSchema = z.enum(["auto", "ai", "manual"]);
export type AnimationMode = z.infer<typeof animationModeSchema>;

export const wordSourceSchema = z.enum(["groq", "interpolated", "manual"]);
export type WordSource = z.infer<typeof wordSourceSchema>;

export const timedWordSchema = z.object({
  id: z.string(),
  text: z.string(),
  normalized: z.string(),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().nonnegative(),
  confidence: z.number().min(0).max(1),
  source: wordSourceSchema.default("groq")
});

export type TimedWord = z.infer<typeof timedWordSchema>;

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

  textTransform: z.enum(["none", "uppercase", "lowercase"]).default("none"),

  backgroundColor: z.string().default("#000000"),
  backgroundOpacity: z.number().min(0).max(1).default(0),
  paddingX: z.number().min(0).max(100).default(20),
  paddingY: z.number().min(0).max(100).default(10),
  borderRadius: z.number().min(0).max(100).default(12)
});

export type TextStyle = z.infer<typeof textStyleSchema>;

export const lyricSegmentSchema = z.object({
  id: z.string(),
  lineIndex: z.number().int().nonnegative(),
  text: z.string(),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().nonnegative(),
  words: z.array(timedWordSchema),
  alignmentConfidence: z.number().min(0).max(1).default(1),
  needsReview: z.boolean().default(false),
  karaokeOverride: z.boolean().optional(),
  animationMode: animationModeSchema.default("auto"),
  animation: animationSchema.default("fade"),
  animationIntensity: z.number().min(0.1).max(3).default(1.0),
  styleOverride: textStyleSchema.partial().optional()
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;

export const projectSchema = z.object({
  version: z.literal(2).default(2),
  id: z.string(),
  title: z.string().default("Untitled Lyrical Video"),
  fps: z.literal(60).default(60),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  duration: z.number().finite().positive(),
  audioAssetId: z.string(),
  backgroundAssetId: z.string().optional(),
  audioUrl: z.string().default(""),
  backgroundUrl: z.string().optional(),
  backgroundColor: z.string().default("#090d16"),
  karaokeEnabled: z.boolean().default(true),
  beatSyncEnabled: z.boolean().default(false),
  bpm: z.number().optional(),
  beatConfidence: z.number().optional(),
  beats: z.array(z.number().nonnegative()).default([]),
  textStyle: textStyleSchema,
  segments: z.array(lyricSegmentSchema)
});

export type EditorProject = z.infer<typeof projectSchema>;

export const defaultTextStyle: TextStyle = textStyleSchema.parse({});
